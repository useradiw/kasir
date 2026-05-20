"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";

// ─── Ingredient stock page ────────────────────────────────────────────────────

export async function getIngredientStockData() {
  await requireRole("OWNER", "MANAGER");

  const ingredients = await prisma.ingredient.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id:              true,
      name:            true,
      category:        true,
      baseUnit:        true,
      currentStock:    true,
      averageUnitCost: true,
      lastUnitCost:    true,
      lastPurchasedAt: true,
      lowStockAlert:   true,
      isActive:        true,
    },
  });

  return ingredients.map((i) => ({
    id:              i.id,
    name:            i.name,
    category:        i.category,
    unit:            i.baseUnit,
    currentStock:    i.currentStock,
    averageUnitCost: i.averageUnitCost,
    lastUnitCost:    i.lastUnitCost,
    lastPurchasedAt: i.lastPurchasedAt,
    lowStockAlert:   i.lowStockAlert,
    isActive:        i.isActive,
    isLow:           i.lowStockAlert !== null && i.currentStock <= i.lowStockAlert,
  }));
}

export type IngredientStockData = Awaited<ReturnType<typeof getIngredientStockData>>;

// ─── Ingredient detail + packs ────────────────────────────────────────────────

export async function getIngredientDetail(id: string) {
  await requireRole("OWNER", "MANAGER");

  const ing = await prisma.ingredient.findUniqueOrThrow({
    where: { id },
    include: {
      packs: { orderBy: { label: "asc" } },
    },
  });

  return {
    id:              ing.id,
    name:            ing.name,
    category:        ing.category,
    baseUnit:        ing.baseUnit,
    currentStock:    ing.currentStock,
    averageUnitCost: ing.averageUnitCost,
    lastUnitCost:    ing.lastUnitCost,
    lastPurchasedAt: ing.lastPurchasedAt,
    lowStockAlert:   ing.lowStockAlert,
    isActive:        ing.isActive,
    notes:           ing.notes,
    packs:           ing.packs,
  };
}

// ─── Ingredient purchase history (for price chart + history tab) ──────────────

export async function getIngredientPurchaseHistory(ingredientId: string, limit = 50) {
  await requireRole("OWNER", "MANAGER");

  return prisma.ingredientPurchase.findMany({
    where:   { ingredientId },
    orderBy: { purchasedAt: "desc" },
    take:    limit,
    select: {
      id:               true,
      source:           true,
      packLabel:        true,
      packQty:          true,
      baseQty:          true,
      totalCost:        true,
      unitCost:         true,
      avgUnitCostAfter: true,
      stockAfter:       true,
      purchasedAt:      true,
      notes:            true,
      supplier:         { select: { name: true } },
    },
  });
}

export type IngredientPurchaseHistory = Awaited<ReturnType<typeof getIngredientPurchaseHistory>>;

// ─── Ingredient log history ───────────────────────────────────────────────────

export async function getIngredientLogs(ingredientId: string, limit = 60) {
  await requireRole("OWNER", "MANAGER");

  return prisma.ingredientLog.findMany({
    where:   { ingredientId },
    orderBy: { createdAt: "desc" },
    take:    limit,
    select: {
      id:          true,
      type:        true,
      quantity:    true,
      unitCost:    true,
      referenceId: true,
      note:        true,
      createdAt:   true,
    },
  });
}

export type IngredientLog = Awaited<ReturnType<typeof getIngredientLogs>>[number];

// ─── Manual stock adjustment ──────────────────────────────────────────────────

export async function adjustIngredientStock(
  ingredientId: string,
  quantity: number,
  note: string,
): Promise<void> {
  await requireRole("OWNER", "MANAGER");
  if (quantity === 0) throw new Error("Jumlah penyesuaian tidak boleh 0");

  const ing = await prisma.ingredient.findUniqueOrThrow({
    where:  { id: ingredientId },
    select: { averageUnitCost: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.ingredientLog.create({
      data: {
        ingredientId,
        templateId: ingredientId,
        type:       quantity > 0 ? "PURCHASE" : "ADJUSTMENT",
        quantity,
        unitCost:   ing.averageUnitCost,
        note:       note.trim() || null,
      },
    });

    if (quantity > 0) {
      await tx.ingredient.update({
        where: { id: ingredientId },
        data:  { currentStock: { increment: quantity } },
      });
    } else {
      await tx.ingredient.update({
        where: { id: ingredientId },
        data:  { currentStock: { decrement: -quantity } },
      });
    }
  });
}

// ─── Low stock alert threshold ────────────────────────────────────────────────

export async function setLowStockAlert(
  ingredientId: string,
  threshold: number | null,
): Promise<void> {
  await requireRole("OWNER", "MANAGER");
  await prisma.ingredient.update({
    where: { id: ingredientId },
    data:  { lowStockAlert: threshold },
  });
}
