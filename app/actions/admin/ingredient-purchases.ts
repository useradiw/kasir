"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwnerStrict } from "@/lib/admin-auth";
import { revalidateIngredients, revalidateExpenses } from "@/lib/revalidate";
import { runAction, ActionError } from "@/lib/action-error";
import { recomputeLastCost } from "@/lib/cogs-utils";

const editSchema = z.object({
  // free-text memory note (e.g. "2 dus"); not resolved to any conversion
  packLabel: z.string().trim().min(1).nullable(),
  // quantity in the ingredient's unit
  packQty:   z.coerce.number().positive("Jumlah harus lebih dari 0"),
  totalCost: z.coerce.number().int().min(0, "Total bayar tidak boleh negatif"),
});

/**
 * Owner-only fix for a single EXPENSE IngredientPurchase row.
 *
 * Last-cost model: there is NO chronological replay. We update the row, adjust
 * stock by the quantity delta, sync the paired ExpenseItem + IngredientLog, then
 * re-derive the ingredient's cost from its latest remaining purchase.
 *
 * Only EXPENSE-source purchases are editable. ASSEMBLY/ADJUSTMENT/OPNAME_GAIN rows
 * are system-generated and have their own flows.
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

      const newQty      = parsed.packQty;
      const newUnitCost = newQty > 0 ? parsed.totalCost / newQty : 0;
      const qtyDelta    = newQty - purchase.baseQty;

      // 1. Update the purchase row
      await tx.ingredientPurchase.update({
        where: { id: purchase.id },
        data: {
          packLabel:        parsed.packLabel,
          packQty:          newQty,
          baseQty:          newQty,
          totalCost:        parsed.totalCost,
          unitCost:         newUnitCost,
          avgUnitCostAfter: newUnitCost,
        },
      });

      // 2. Adjust stock by the quantity delta
      if (qtyDelta !== 0) {
        await tx.ingredient.update({
          where: { id: purchase.ingredientId },
          data:  { currentStock: { increment: qtyDelta } },
        });
      }

      // 3. Sync the paired ExpenseItem + IngredientLog so the Pengeluaran view matches
      if (purchase.expenseItemId) {
        await tx.expenseItem.update({
          where: { id: purchase.expenseItemId },
          data: { unit: parsed.packLabel, amount: newQty, cost: Math.round(newUnitCost) },
        });
        await tx.ingredientLog.updateMany({
          where: { ingredientId: purchase.ingredientId, type: "PURCHASE", referenceId: purchase.expenseItemId },
          data:  { quantity: newQty, unitCost: newUnitCost },
        });
      }

      // 4. Re-derive cost from the latest remaining purchase
      await recomputeLastCost(tx, purchase.ingredientId);

      // 5. Audit row
      await tx.ingredientLog.create({
        data: {
          ingredientId: purchase.ingredientId,
          type:         "ADJUSTMENT",
          quantity:     0,
          unitCost:     0,
          note: `Edit pembelian (oleh ${staff.name}): ` +
                `qty ${purchase.baseQty} → ${newQty}; totalCost ${purchase.totalCost} → ${parsed.totalCost}.`,
        },
      });
    }, { timeout: 30_000 });

    revalidateIngredients();
    revalidateExpenses();
  });
}

/**
 * Owner-only delete of a single EXPENSE purchase row: removes the row, reverses
 * its stock, unlinks/updates the paired ExpenseItem, and re-derives cost.
 */
export async function deletePurchase(purchaseId: string) {
  return runAction(async () => {
    const staff = await requireOwnerStrict();

    await prisma.$transaction(async (tx) => {
      const purchase = await tx.ingredientPurchase.findUniqueOrThrow({
        where:  { id: purchaseId },
        select: { id: true, ingredientId: true, source: true, expenseItemId: true, baseQty: true, unitCost: true },
      });
      if (purchase.source !== "EXPENSE") {
        throw new ActionError(
          `Hanya pembelian dari pengeluaran (EXPENSE) yang bisa dihapus di sini. Baris ini sourcenya ${purchase.source}.`,
        );
      }

      await tx.ingredientPurchase.delete({ where: { id: purchase.id } });
      await tx.ingredient.update({
        where: { id: purchase.ingredientId },
        data:  { currentStock: { decrement: purchase.baseQty } },
      });

      if (purchase.expenseItemId) {
        await tx.expenseItem.update({
          where: { id: purchase.expenseItemId },
          data:  { ingredientId: null },
        });
      }

      await tx.ingredientLog.create({
        data: {
          ingredientId: purchase.ingredientId,
          type:         "ADJUSTMENT",
          quantity:     -purchase.baseQty,
          unitCost:     purchase.unitCost,
          note:         `Hapus pembelian (oleh ${staff.name})`,
        },
      });

      await recomputeLastCost(tx, purchase.ingredientId);
    });

    revalidateIngredients();
    revalidateExpenses();
  });
}
