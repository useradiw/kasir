"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireRoleStrict } from "@/lib/admin-auth";
import { revalidateIngredients } from "@/lib/revalidate";
import { runAction } from "@/lib/action-error";

const ingredientSchema = z.object({
  name:         z.string().min(1, "Nama tidak boleh kosong"),
  category:     z.enum(["BAHAN", "KEMASAN", "PERLENGKAPAN", "LAINNYA"]).default("BAHAN"),
  baseUnit:     z.string().min(1, "Satuan dasar harus diisi"),
  lowStockAlert: z.coerce.number().nullable().optional(),
  notes:        z.string().optional(),
});

const packSchema = z.object({
  label:     z.string().min(1, "Label satuan harus diisi"),
  baseQty:   z.coerce.number().positive("Qty per satuan harus lebih dari 0"),
  isDefault: z.boolean().optional(),
});

export async function addIngredient(data: {
  name: string;
  category?: "BAHAN" | "KEMASAN" | "PERLENGKAPAN" | "LAINNYA";
  baseUnit: string;
  lowStockAlert?: number | null;
  notes?: string;
}) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const parsed = ingredientSchema.parse(data);
    const ing = await prisma.ingredient.create({
      data: {
        name:          parsed.name,
        category:      parsed.category,
        baseUnit:      parsed.baseUnit,
        lowStockAlert: parsed.lowStockAlert ?? null,
        notes:         parsed.notes || null,
      },
    });
    revalidateIngredients();
    return ing.id;
  });
}

export async function updateIngredient(id: string, data: {
  name: string;
  category?: "BAHAN" | "KEMASAN" | "PERLENGKAPAN" | "LAINNYA";
  baseUnit: string;
  lowStockAlert?: number | null;
  notes?: string;
}) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const parsed = ingredientSchema.parse(data);
    await prisma.ingredient.update({
      where: { id },
      data: {
        name:          parsed.name,
        category:      parsed.category,
        baseUnit:      parsed.baseUnit,
        lowStockAlert: parsed.lowStockAlert ?? null,
        notes:         parsed.notes || null,
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

    const existing = await prisma.ingredientPack.findUniqueOrThrow({ where: { id }, select: { ingredientId: true } });

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
  baseUnit: string;
  lowStockAlert?: number | null;
  notes?: string;
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
          name:          r.name,
          category:      r.category,
          baseUnit:      r.baseUnit,
          lowStockAlert: r.lowStockAlert ?? null,
          notes:         r.notes || null,
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
    const cost = Math.round(unitCost);
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
