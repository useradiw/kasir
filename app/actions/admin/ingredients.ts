"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireRoleStrict } from "@/lib/admin-auth";
import { revalidateIngredients } from "@/lib/revalidate";
import { runAction } from "@/lib/action-error";
import { getSettings } from "@/lib/settings";
import {
  resolveBaseUnit,
  inferUnitClass,
  type UnitClassName,
} from "@/lib/unit-class";

const UnitClassEnum = z.enum(["WEIGHT", "VOLUME", "COUNT"]);

const ingredientSchema = z.object({
  name:              z.string().min(1, "Nama tidak boleh kosong"),
  category:          z.enum(["BAHAN", "KEMASAN", "PERLENGKAPAN", "LAINNYA"]).default("BAHAN"),
  unitClass:         UnitClassEnum,
  baseUnit:          z.string().min(1).optional(), // ignored on create — derived from unitClass + Setting
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

/**
 * Soft cross-class check on a pack label: if the user typed a label that looks
 * like a recognizable unit (e.g. "kg"), block it when the inferred class doesn't
 * match the parent ingredient. Free-form labels like "dus" / "renteng" pass
 * through unchanged — the baseQty multiplier carries the real conversion.
 */
function assertPackLabelClassMatches(label: string, parentClass: UnitClassName) {
  const inferred = inferUnitClass(label);
  if (inferred && inferred !== parentClass) {
    throw new Error(
      `Label "${label}" termasuk kelas ${inferred}, tapi bahan ini kelas ${parentClass}. ` +
      `Gunakan satuan dalam kelas ${parentClass} atau ganti label menjadi nama paket (mis. "dus", "botol", "renteng").`,
    );
  }
}

/** Returns true if the ingredient has any history that would make base-unit changes unsafe. */
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
  unitClass: UnitClassName;
  lowStockAlert?: number | null;
  notes?: string;
  defaultSupplierId?: string | null;
  tags?: string[];
}) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const parsed = ingredientSchema.parse(data);
    const settings = await getSettings();
    const baseUnit = resolveBaseUnit(parsed.unitClass, settings);
    const ing = await prisma.ingredient.create({
      data: {
        name:              parsed.name,
        category:          parsed.category,
        unitClass:         parsed.unitClass,
        baseUnit,
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
  unitClass: UnitClassName;
  baseUnit?: string;
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
      select: { unitClass: true, baseUnit: true },
    });

    const settings   = await getSettings();
    const wantBase   = resolveBaseUnit(parsed.unitClass, settings);
    const classChange = current.unitClass !== parsed.unitClass;
    const baseChange  = current.baseUnit  !== wantBase;

    if ((classChange || baseChange) && await hasStockHistory(id)) {
      throw new Error(
        "Tidak bisa mengubah satuan/kelas: sudah ada riwayat stok/pemakaian/resep. " +
        "Buat bahan baru atau lakukan opname nol dulu.",
      );
    }

    await prisma.ingredient.update({
      where: { id },
      data: {
        name:              parsed.name,
        category:          parsed.category,
        unitClass:         parsed.unitClass,
        baseUnit:          wantBase,
        lowStockAlert:     parsed.lowStockAlert ?? null,
        notes:             parsed.notes || null,
        defaultSupplierId: parsed.defaultSupplierId || null,
        tags:              parsed.tags ?? [],
      },
    });
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

    const parent = await prisma.ingredient.findUniqueOrThrow({
      where:  { id: ingredientId },
      select: { unitClass: true },
    });
    assertPackLabelClassMatches(parsed.label, parent.unitClass);

    if (parsed.isDefault) {
      await prisma.ingredientPack.updateMany({
        where: { ingredientId, isDefault: true },
        data:  { isDefault: false },
      });
    }

    await prisma.ingredientPack.create({
      data: { ingredientId, label: parsed.label, baseQty: parsed.baseQty, isDefault: parsed.isDefault ?? false },
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
      select: { ingredientId: true, label: true, baseQty: true,
                ingredient: { select: { unitClass: true } } },
    });
    assertPackLabelClassMatches(parsed.label, existing.ingredient.unitClass);

    // Changing baseQty after purchases reference this pack would silently
    // invalidate the historical baseQty math (and through it, every WMA/COGS
    // number computed since). Block it. Label rename and default toggle stay
    // free — they don't change the conversion factor.
    if (parsed.baseQty !== existing.baseQty) {
      const inUse = await prisma.ingredientPurchase.count({
        where: { ingredientId: existing.ingredientId, packLabel: existing.label },
      });
      if (inUse > 0) {
        throw new Error(
          `Konversi (${existing.baseQty}) tidak bisa diubah: paket "${existing.label}" ` +
          `sudah dipakai di ${inUse} pembelian. Buat satuan baru jika konversinya beda.`,
        );
      }
    }

    if (parsed.isDefault) {
      await prisma.ingredientPack.updateMany({
        where: { ingredientId: existing.ingredientId, isDefault: true, id: { not: id } },
        data:  { isDefault: false },
      });
    }

    await prisma.ingredientPack.update({
      where: { id },
      data:  { label: parsed.label, baseQty: parsed.baseQty, isDefault: parsed.isDefault ?? false },
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
  unitClass: UnitClassName;
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
      const settings = await getSettings();
      await prisma.ingredient.createMany({
        data: toCreate.map((r) => ({
          name:              r.name,
          category:          r.category,
          unitClass:         r.unitClass,
          baseUnit:          resolveBaseUnit(r.unitClass, settings),
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

export async function linkExpenseItemsToIngredient(ingredientId: string, expenseItemIds: string[]) {
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
        items.map((i) => ({
          ingredientId,
          supplierId:    i.expense.supplierId ?? null,
          expenseItemId: i.id,
          source:        "EXPENSE" as const,
          packLabel:     i.unit,
          packQty:       i.amount,
          totalCost:     Math.round(i.amount * i.cost),
          purchasedAt:   i.expense.recordedAt,
          recordedById:  staff.id,
        })),
      );
      linked = items.length;
    });
    revalidateIngredients();
    return { linked };
  });
}
