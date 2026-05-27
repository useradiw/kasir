"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwnerStrict } from "@/lib/admin-auth";
import { revalidateIngredients, revalidateExpenses } from "@/lib/revalidate";
import { runAction, ActionError } from "@/lib/action-error";

const editSchema = z.object({
  packLabel: z.string().trim().min(1).nullable(),
  packQty:   z.coerce.number().positive("Qty pack harus lebih dari 0"),
  totalCost: z.coerce.number().int().min(0, "Total bayar tidak boleh negatif"),
});

/**
 * Owner-only fix for a single IngredientPurchase row.
 *
 * Re-derives baseQty/unitCost from the *current* pack definition, keeps totalCost
 * (it's the receipt), updates the matching IngredientLog and ExpenseItem so the
 * three stay in sync, then replays the entire ingredient's history chronologically
 * to recompute every purchase row's avgUnitCostAfter+stockAfter and the
 * Ingredient's currentStock+averageUnitCost+lastUnitCost.
 *
 * Only EXPENSE-source purchases are editable. ASSEMBLY/ADJUSTMENT/OPNAME_GAIN rows
 * are system-generated and editing them would need a different flow.
 *
 * Invariant: total Rp on hand (Σ purchase.totalCost minus value of stock out) is
 * unchanged by the edit *per se* — only the unit reconciliation moves around. If
 * the WMA shifts, that's expected: it propagates the correct cost basis forward.
 */
export async function editPurchase(purchaseId: string, raw: {
  packLabel: string | null;
  packQty:   number;
  totalCost: number;
}) {
  return runAction(async () => {
    const staff = await requireOwnerStrict();
    const parsed = editSchema.parse(raw);

    await prisma.$transaction(async (tx) => {
      const purchase = await tx.ingredientPurchase.findUniqueOrThrow({
        where:  { id: purchaseId },
        select: {
          id: true, ingredientId: true, source: true, expenseItemId: true,
          packLabel: true, packQty: true, baseQty: true, totalCost: true, unitCost: true,
        },
      });

      if (purchase.source !== "EXPENSE") {
        throw new ActionError(
          `Hanya pembelian dari pengeluaran (EXPENSE) yang bisa di-edit. Baris ini sourcenya ${purchase.source}.`,
        );
      }

      // Resolve new baseQty via current pack definition (or 1 if packLabel=null).
      let packBaseQty = 1;
      if (parsed.packLabel) {
        const pack = await tx.ingredientPack.findUnique({
          where:  { ingredientId_label: { ingredientId: purchase.ingredientId, label: parsed.packLabel } },
          select: { baseQty: true },
        });
        if (!pack) {
          throw new ActionError(
            `Pack "${parsed.packLabel}" belum terdaftar untuk bahan ini. Tambahkan dulu di tab Pengaturan.`,
          );
        }
        packBaseQty = pack.baseQty;
      }
      const newBaseQty  = parsed.packQty * packBaseQty;
      const newUnitCost = newBaseQty > 0 ? parsed.totalCost / newBaseQty : 0;

      // 1. Update the purchase row (avgUnitCostAfter and stockAfter will be recomputed by replay)
      await tx.ingredientPurchase.update({
        where: { id: purchase.id },
        data: {
          packLabel: parsed.packLabel,
          packQty:   parsed.packQty,
          baseQty:   newBaseQty,
          totalCost: parsed.totalCost,
          unitCost:  newUnitCost,
        },
      });

      // 2. Sync the matching ExpenseItem (Pengeluaran view stays consistent)
      if (purchase.expenseItemId) {
        const cost = parsed.packQty > 0 ? Math.round(parsed.totalCost / parsed.packQty) : 0;
        await tx.expenseItem.update({
          where: { id: purchase.expenseItemId },
          data: {
            unit:   parsed.packLabel,
            amount: parsed.packQty,
            cost,
          },
        });

        // 3. Sync the paired IngredientLog (matched via referenceId = expenseItemId)
        await tx.ingredientLog.updateMany({
          where:  { ingredientId: purchase.ingredientId, type: "PURCHASE", referenceId: purchase.expenseItemId },
          data:   { quantity: newBaseQty, unitCost: newUnitCost },
        });
      }

      // 4. Replay: merge purchases + logs by chronological order, recompute everything.
      await replayIngredientHistory(tx, purchase.ingredientId);

      // 5. Audit row
      await tx.ingredientLog.create({
        data: {
          ingredientId: purchase.ingredientId,
          type:         "ADJUSTMENT",
          quantity:     0,
          unitCost:     0,
          note: `Edit pembelian (oleh ${staff.name}): ` +
                `${purchase.packLabel ?? "—"} ${purchase.packQty} → ${parsed.packLabel ?? "—"} ${parsed.packQty}; ` +
                `totalCost ${purchase.totalCost} → ${parsed.totalCost}; ` +
                `baseQty ${purchase.baseQty} → ${newBaseQty}; WMA + stok di-replay.`,
        },
      });
    }, { timeout: 30_000 });

    revalidateIngredients();
    revalidateExpenses();
  });
}

/**
 * Recompute every IngredientPurchase row's avgUnitCostAfter+stockAfter and the
 * Ingredient's denormalized currentStock+averageUnitCost+lastUnitCost by walking
 * the merged chronological timeline of purchases + logs.
 *
 * Rules:
 *  - Stock is the cumulative sum of every IngredientLog.quantity (signed). Logs
 *    that ARE paired with a purchase row are still counted via the purchase walk
 *    (we skip them in the log pass to avoid double-counting).
 *  - WMA folds in on each non-ADJUSTMENT purchase using its totalCost.
 *  - ADJUSTMENT-source purchases SET avg directly (manual HPP override) and do
 *    not change stock.
 *  - For paired matching: type=PURCHASE log ↔ EXPENSE purchase by referenceId =
 *    expenseItemId. type=ASSEMBLY positive log ↔ ASSEMBLY purchase by timestamp
 *    proximity (same ingredient, ±1s, both produce-side).
 *
 * Bounded by ingredient history size. For a typical bahan (tens to low hundreds
 * of events) this is well under a second.
 */
async function replayIngredientHistory(tx: import("@/generated/prisma").Prisma.TransactionClient, ingredientId: string) {
  const [purchases, logs] = await Promise.all([
    tx.ingredientPurchase.findMany({
      where:   { ingredientId },
      orderBy: [{ purchasedAt: "asc" }, { id: "asc" }],
      select: {
        id: true, source: true, expenseItemId: true, packQty: true, baseQty: true,
        totalCost: true, unitCost: true, purchasedAt: true,
      },
    }),
    tx.ingredientLog.findMany({
      where:   { ingredientId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, type: true, quantity: true, referenceId: true, createdAt: true },
    }),
  ]);

  // Identify logs that are paired with a purchase row (so we skip them in the log walk)
  const pairedLogIds = new Set<string>();
  for (const lg of logs) {
    if (lg.type === "PURCHASE" && lg.referenceId) {
      const match = purchases.find((p) => p.source === "EXPENSE" && p.expenseItemId === lg.referenceId);
      if (match) pairedLogIds.add(lg.id);
    } else if (lg.type === "ASSEMBLY" && lg.quantity > 0) {
      const match = purchases.find(
        (p) => p.source === "ASSEMBLY" &&
               Math.abs(p.purchasedAt.getTime() - lg.createdAt.getTime()) < 1000,
      );
      if (match) pairedLogIds.add(lg.id);
    }
  }

  type Event =
    | { kind: "purchase"; t: number; idx: number }
    | { kind: "log"; t: number; idx: number };

  const events: Event[] = [
    ...purchases.map((p, i) => ({ kind: "purchase" as const, t: p.purchasedAt.getTime(), idx: i })),
    ...logs
      .map((l, i) => ({ lg: l, idx: i }))
      .filter((x) => !pairedLogIds.has(x.lg.id))
      .map((x) => ({ kind: "log" as const, t: x.lg.createdAt.getTime(), idx: x.idx })),
  ];
  events.sort((a, b) => a.t - b.t || (a.kind === "purchase" ? -1 : 1));

  let stock = 0;
  let avg = 0;
  let lastUnitCost: number | null = null;
  const purchaseUpdates: { id: string; avgUnitCostAfter: number; stockAfter: number }[] = [];

  for (const ev of events) {
    if (ev.kind === "purchase") {
      const p = purchases[ev.idx];
      if (p.source === "ADJUSTMENT") {
        // Manual HPP override sets avg directly; no stock movement.
        avg = p.unitCost;
        lastUnitCost = p.unitCost;
      } else {
        const newStock = stock + p.baseQty;
        avg = newStock > 0
          ? (avg * stock + p.totalCost) / newStock
          : p.unitCost;
        stock = newStock;
        lastUnitCost = p.unitCost;
      }
      purchaseUpdates.push({ id: p.id, avgUnitCostAfter: avg, stockAfter: stock });
    } else {
      const lg = logs[ev.idx];
      stock += lg.quantity;
    }
  }

  // Persist purchase row updates
  for (const u of purchaseUpdates) {
    await tx.ingredientPurchase.update({
      where: { id: u.id },
      data:  { avgUnitCostAfter: u.avgUnitCostAfter, stockAfter: u.stockAfter },
    });
  }

  // Finalize the ingredient
  await tx.ingredient.update({
    where: { id: ingredientId },
    data: {
      currentStock:    stock,
      averageUnitCost: avg,
      lastUnitCost:    lastUnitCost,
    },
  });
}
