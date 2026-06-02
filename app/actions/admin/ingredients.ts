"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireRoleStrict } from "@/lib/admin-auth";
import { revalidateIngredients } from "@/lib/revalidate";
import { runAction } from "@/lib/action-error";

const ingredientSchema = z.object({
  name:              z.string().min(1, "Nama tidak boleh kosong"),
  category:          z.enum(["BAHAN", "KEMASAN", "PERLENGKAPAN", "LAINNYA"]).default("BAHAN"),
  unit:              z.string().min(1, "Satuan tidak boleh kosong"),
  lowStockAlert:     z.coerce.number().nullable().optional(),
  notes:             z.string().optional(),
  defaultSupplierId: z.string().nullable().optional(),
  tags:              z.array(z.string().min(1)).optional(),
});

const packSchema = z.object({
  label:     z.string().min(1, "Label satuan harus diisi"),
  baseQty:   z.coerce.number().positive("Qty per satuan harus lebih dari 0"),
  isDefault: z.boolean().optional(),
});

/** Returns true if the ingredient has any history that would make a plain unit relabel unsafe. */
async function hasStockHistory(id: string): Promise<boolean> {
  const [purchases, logs, recipeRefs, componentRefs, ing] = await Promise.all([
    prisma.ingredientPurchase.count({ where: { ingredientId: id } }),
    prisma.ingredientLog.count({ where: { ingredientId: id } }),
    prisma.recipeIngredient.count({ where: { ingredientId: id } }),
    prisma.ingredientRecipeItem.count({ where: { ingredientId: id } }),
    prisma.ingredient.findUnique({ where: { id }, select: { currentStock: true } }),
  ]);
  if (purchases > 0 || logs > 0 || recipeRefs > 0 || componentRefs > 0) return true;
  if (ing && ing.currentStock !== 0) return true;
  return false;
}

export async function addIngredient(data: {
  name: string;
  category?: "BAHAN" | "KEMASAN" | "PERLENGKAPAN" | "LAINNYA";
  unit: string;
  lowStockAlert?: number | null;
  notes?: string;
  defaultSupplierId?: string | null;
  tags?: string[];
}) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const parsed = ingredientSchema.parse(data);
    const ing = await prisma.ingredient.create({
      data: {
        name:              parsed.name,
        category:          parsed.category,
        baseUnit:          parsed.unit.trim(),
        lowStockAlert:     parsed.lowStockAlert ?? null,
        notes:             parsed.notes || null,
        defaultSupplierId: parsed.defaultSupplierId || null,
        tags:              parsed.tags ?? [],
      },
    });
    revalidateIngredients();
    return ing.id;
  });
}

export async function updateIngredient(id: string, data: {
  name: string;
  category?: "BAHAN" | "KEMASAN" | "PERLENGKAPAN" | "LAINNYA";
  unit: string;
  lowStockAlert?: number | null;
  notes?: string;
  defaultSupplierId?: string | null;
  tags?: string[];
}) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const parsed = ingredientSchema.parse(data);

    const current = await prisma.ingredient.findUniqueOrThrow({
      where:  { id },
      select: { baseUnit: true },
    });

    const wantUnit   = parsed.unit.trim();
    const unitChange = current.baseUnit !== wantUnit;

    // A plain relabel is only safe with no history — otherwise stock/cost/recipe
    // quantities would silently mean a different thing. Use changeIngredientUnit
    // (Ubah Satuan) to rescale everything atomically instead.
    if (unitChange && await hasStockHistory(id)) {
      throw new Error(
        "Tidak bisa mengganti satuan langsung: sudah ada riwayat stok/pemakaian/resep. " +
        "Gunakan \"Ubah Satuan\" agar stok, HPP, dan resep ikut dikonversi.",
      );
    }

    await prisma.ingredient.update({
      where: { id },
      data: {
        name:              parsed.name,
        category:          parsed.category,
        baseUnit:          wantUnit,
        lowStockAlert:     parsed.lowStockAlert ?? null,
        notes:             parsed.notes || null,
        defaultSupplierId: parsed.defaultSupplierId || null,
        tags:              parsed.tags ?? [],
      },
    });
    revalidateIngredients();
  });
}

/**
 * Owner-guided unit conversion. Rescales EVERYTHING tracked in the old unit to a
 * new unit in one transaction, so stock, cost and every recipe stay coherent.
 *
 * `factor` = how many OLD units equal ONE new unit (e.g. converting "g" → "kg",
 * factor = 1000). Quantities are divided by the factor; per-unit costs are
 * multiplied by it. Rupiah totals (purchase totalCost) are unchanged.
 */
export async function changeIngredientUnit(id: string, newUnit: string, factor: number) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const unit = String(newUnit ?? "").trim();
    const f = Number(factor);
    if (!unit) throw new Error("Satuan baru tidak boleh kosong.");
    if (!Number.isFinite(f) || f <= 0) throw new Error("Faktor konversi harus lebih dari 0.");

    await prisma.$transaction(async (tx) => {
      const ing = await tx.ingredient.findUniqueOrThrow({
        where:  { id },
        select: { baseUnit: true, currentStock: true, averageUnitCost: true, lastUnitCost: true },
      });

      // Ingredient denormalized values
      await tx.ingredient.update({
        where: { id },
        data: {
          baseUnit:        unit,
          currentStock:    ing.currentStock / f,
          averageUnitCost: ing.averageUnitCost * f,
          lastUnitCost:    ing.lastUnitCost == null ? null : ing.lastUnitCost * f,
        },
      });

      // Recipe quantities that reference this ingredient (menu + assembled BOM)
      const recipeItems = await tx.recipeIngredient.findMany({
        where: { ingredientId: id }, select: { id: true, quantity: true },
      });
      for (const r of recipeItems) {
        await tx.recipeIngredient.update({ where: { id: r.id }, data: { quantity: r.quantity / f } });
      }
      const bomItems = await tx.ingredientRecipeItem.findMany({
        where: { ingredientId: id }, select: { id: true, quantity: true },
      });
      for (const b of bomItems) {
        await tx.ingredientRecipeItem.update({ where: { id: b.id }, data: { quantity: b.quantity / f } });
      }

      // Purchase ledger snapshots (qty ÷ f, per-unit costs × f; totalCost unchanged)
      const purchases = await tx.ingredientPurchase.findMany({
        where: { ingredientId: id },
        select: { id: true, packQty: true, baseQty: true, unitCost: true, avgUnitCostAfter: true, stockAfter: true },
      });
      for (const p of purchases) {
        await tx.ingredientPurchase.update({
          where: { id: p.id },
          data: {
            packQty:          p.packQty / f,
            baseQty:          p.baseQty / f,
            unitCost:         p.unitCost * f,
            avgUnitCostAfter: p.avgUnitCostAfter * f,
            stockAfter:       p.stockAfter / f,
          },
        });
      }

      // Movement ledger (quantity ÷ f, unitCost × f)
      const logs = await tx.ingredientLog.findMany({
        where: { ingredientId: id }, select: { id: true, quantity: true, unitCost: true },
      });
      for (const l of logs) {
        await tx.ingredientLog.update({
          where: { id: l.id },
          data: { quantity: l.quantity / f, unitCost: l.unitCost * f },
        });
      }

      // Audit trail
      await tx.ingredientLog.create({
        data: {
          ingredientId: id,
          type:         "ADJUSTMENT",
          quantity:     0,
          unitCost:     0,
          note:         `Ubah satuan: ${ing.baseUnit} → ${unit} (1 ${unit} = ${f} ${ing.baseUnit})`,
        },
      });
    }, { timeout: 30_000 });

    revalidateIngredients();
  });
}

export async function deactivateIngredient(id: string) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    await prisma.ingredient.update({
      where: { id },
      data: { isActive: false },
    });
    revalidateIngredients();
  });
}

export async function addIngredientPack(ingredientId: string, data: {
  label: string;
  baseQty: number;
  isDefault?: boolean;
}) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const parsed = packSchema.parse(data);

    await prisma.$transaction(async (tx) => {
      if (parsed.isDefault) {
        await tx.ingredientPack.updateMany({
          where: { ingredientId, isDefault: true },
          data:  { isDefault: false },
        });
      }
      await tx.ingredientPack.create({
        data: { ingredientId, label: parsed.label, baseQty: parsed.baseQty, isDefault: parsed.isDefault ?? false },
      });
    });
    revalidateIngredients();
  });
}

export async function updateIngredientPack(id: string, data: {
  label: string;
  baseQty: number;
  isDefault?: boolean;
}) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const parsed = packSchema.parse(data);

    const existing = await prisma.ingredientPack.findUniqueOrThrow({
      where:  { id },
      select: { ingredientId: true, label: true, baseQty: true },
    });

    await prisma.$transaction(async (tx) => {
      if (parsed.isDefault) {
        await tx.ingredientPack.updateMany({
          where: { ingredientId: existing.ingredientId, isDefault: true, id: { not: id } },
          data:  { isDefault: false },
        });
      }
      await tx.ingredientPack.update({
        where: { id },
        data:  { label: parsed.label, baseQty: parsed.baseQty, isDefault: parsed.isDefault ?? false },
      });
    });
    revalidateIngredients();
  });
}

export async function deleteIngredientPack(id: string) {
  return runAction(async () => {
    await requireRoleStrict("OWNER", "MANAGER");
    await prisma.ingredientPack.delete({ where: { id } });
    revalidateIngredients();
  });
}

export async function recordWasteAction(
  ingredientId: string,
  quantity: number,
  reason?: string,
) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    if (quantity <= 0) throw new Error("Jumlah pemborosan harus lebih dari 0");
    const { recordWaste } = await import("@/lib/cogs-utils");
    await prisma.$transaction(async (tx) => {
      await recordWaste(tx, ingredientId, quantity, reason || null);
    });
    revalidateIngredients();
  });
}

export async function addIngredientsBulk(rows: Array<{
  name: string;
  category?: "BAHAN" | "KEMASAN" | "PERLENGKAPAN" | "LAINNYA";
  unit: string;
  lowStockAlert?: number | null;
  notes?: string;
  defaultSupplierId?: string | null;
  tags?: string[];
}>) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const parsed = z.array(ingredientSchema).min(1, "Tidak ada baris untuk disimpan").parse(rows);

    const existing = await prisma.ingredient.findMany({
      where:  { name: { in: parsed.map((r) => r.name) } },
      select: { name: true },
    });
    const taken   = new Set(existing.map((e) => e.name));
    const seen    = new Set<string>();
    const skipped: string[] = [];
    const toCreate: typeof parsed = [];
    for (const r of parsed) {
      if (taken.has(r.name) || seen.has(r.name)) { skipped.push(r.name); continue; }
      seen.add(r.name);
      toCreate.push(r);
    }

    if (toCreate.length > 0) {
      await prisma.ingredient.createMany({
        data: toCreate.map((r) => ({
          name:              r.name,
          category:          r.category,
          baseUnit:          r.unit.trim(),
          lowStockAlert:     r.lowStockAlert ?? null,
          notes:             r.notes || null,
          defaultSupplierId: r.defaultSupplierId || null,
          tags:              r.tags ?? [],
        })),
        skipDuplicates: true,
      });
    }
    revalidateIngredients();
    return { created: toCreate.length, skipped };
  });
}

export async function setIngredientCost(id: string, unitCost: number, note?: string) {
  return runAction(async () => {
    const staff = await requireRole("OWNER", "MANAGER");
    const cost = Number(unitCost);
    if (!Number.isFinite(cost) || cost < 0) throw new Error("HPP harus angka 0 atau lebih.");

    await prisma.$transaction(async (tx) => {
      const ing = await tx.ingredient.findUniqueOrThrow({
        where:  { id },
        select: { currentStock: true },
      });
      await tx.ingredient.update({
        where: { id },
        data:  { averageUnitCost: cost, lastUnitCost: cost },
      });
      await tx.ingredientPurchase.create({
        data: {
          ingredientId:     id,
          source:           "ADJUSTMENT",
          packLabel:        null,
          packQty:          0,
          baseQty:          0,
          totalCost:        0,
          unitCost:         cost,
          avgUnitCostAfter: cost,
          stockAfter:       ing.currentStock,
          recordedById:     staff.id,
          notes:            note?.trim() || "Set HPP manual",
        },
      });
    });
    revalidateIngredients();
  });
}

/**
 * Links historical expense items to an ingredient and records them as purchases.
 *
 * No unit conversion / pack resolution: the quantity that goes to stock is the
 * expense item's `amount`, unless `qtyOverrides[expenseItemId]` supplies a
 * corrected quantity expressed in the ingredient's unit (e.g. the item says
 * "2 dus" but the ingredient is tracked in "butir" → override with 60). The
 * original `unit` text is kept as a free-text note on the purchase.
 */
export async function linkExpenseItemsToIngredient(
  ingredientId: string,
  expenseItemIds: string[],
  qtyOverrides?: Record<string, number>,
) {
  return runAction(async () => {
    const staff = await requireRole("OWNER", "MANAGER");
    if (expenseItemIds.length === 0) throw new Error("Pilih minimal satu pembelian.");
    const { recordPurchasesBatch } = await import("@/lib/cogs-utils");

    let linked = 0;
    await prisma.$transaction(async (tx) => {
      const items = await tx.expenseItem.findMany({
        where: {
          id:           { in: expenseItemIds },
          ingredientId: null,
          purchase:     { is: null },
        },
        include: { expense: { select: { recordedAt: true, supplierId: true } } },
      });
      if (items.length === 0) throw new Error("Pembelian tidak ditemukan atau sudah tertaut.");
      items.sort((a, b) => a.expense.recordedAt.getTime() - b.expense.recordedAt.getTime());

      await tx.expenseItem.updateMany({
        where: { id: { in: items.map((i) => i.id) } },
        data:  { ingredientId },
      });
      await recordPurchasesBatch(
        tx,
        items.map((i) => {
          const qty = qtyOverrides?.[i.id] ?? i.amount;
          return {
            ingredientId,
            supplierId:    i.expense.supplierId ?? null,
            expenseItemId: i.id,
            source:        "EXPENSE" as const,
            packLabel:     i.unit,            // free-text memory note only
            packQty:       qty,               // quantity in the ingredient's unit
            totalCost:     Math.round(i.amount * i.cost),
            purchasedAt:   i.expense.recordedAt,
            recordedById:  staff.id,
          };
        }),
      );
      linked = items.length;
    });
    revalidateIngredients();
    return { linked };
  });
}
