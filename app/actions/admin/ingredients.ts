"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";
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
    await requireRole("OWNER", "MANAGER");
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
