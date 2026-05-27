"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";

// ─── Ingredient stock page ────────────────────────────────────────────────────

export async function getIngredientStockData() {
  await requireRole("OWNER", "MANAGER");

  const ingredients = await prisma.ingredient.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id:                true,
      name:              true,
      category:          true,
      baseUnit:          true,
      unitClass:         true,
      currentStock:      true,
      averageUnitCost:   true,
      lastUnitCost:      true,
      lastPurchasedAt:   true,
      lowStockAlert:     true,
      isActive:          true,
      notes:             true,
      defaultSupplierId: true,
      defaultSupplier:   { select: { id: true, name: true } },
      tags:              true,
      producedRecipe:    { select: { id: true } },
    },
  });

  return ingredients.map((i) => ({
    id:                i.id,
    name:              i.name,
    category:          i.category,
    unit:              i.baseUnit,
    unitClass:         i.unitClass,
    currentStock:      i.currentStock,
    averageUnitCost:   i.averageUnitCost,
    lastUnitCost:      i.lastUnitCost,
    lastPurchasedAt:   i.lastPurchasedAt,
    lowStockAlert:     i.lowStockAlert,
    isActive:          i.isActive,
    notes:             i.notes,
    defaultSupplierId: i.defaultSupplierId,
    defaultSupplierName: i.defaultSupplier?.name ?? null,
    tags:              i.tags,
    hasRecipe:         !!i.producedRecipe,
    isLow:             i.lowStockAlert !== null && i.currentStock <= i.lowStockAlert,
  }));
}

export type IngredientStockData = Awaited<ReturnType<typeof getIngredientStockData>>;

// ─── Ingredient detail + packs ────────────────────────────────────────────────

export async function getIngredientDetail(id: string) {
  await requireRole("OWNER", "MANAGER");

  return prisma.ingredient.findUniqueOrThrow({
    where: { id },
    select: {
      id:                true,
      name:              true,
      category:          true,
      baseUnit:          true,
      unitClass:         true,
      currentStock:      true,
      averageUnitCost:   true,
      lastUnitCost:      true,
      lastPurchasedAt:   true,
      lowStockAlert:     true,
      isActive:          true,
      notes:             true,
      defaultSupplierId: true,
      tags:              true,
      packs:             { orderBy: { label: "asc" } },
    },
  });
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

// ─── Ingredient recipe (a material assembled from other ingredients) ──────────

export async function getIngredientRecipe(ingredientId: string) {
  await requireRole("OWNER", "MANAGER");

  const recipe = await prisma.ingredientRecipe.findUnique({
    where: { ingredientId },
    include: {
      items: {
        include: {
          ingredient: { select: { id: true, name: true, baseUnit: true, unitClass: true, averageUnitCost: true } },
        },
        orderBy: { ingredient: { name: "asc" } },
      },
      ingredient: { select: { unitClass: true } },
    },
  });

  if (!recipe) return null;

  return {
    id:             recipe.id,
    yieldQty:       recipe.yieldQty,
    notes:          recipe.notes,
    parentUnitClass: recipe.ingredient.unitClass,
    items: recipe.items.map((it) => ({
      id:              it.id,
      ingredientId:    it.ingredientId,
      ingredientName:  it.ingredient.name,
      ingredientUnit:  it.ingredient.baseUnit,
      ingredientClass: it.ingredient.unitClass,
      averageUnitCost: it.ingredient.averageUnitCost,
      quantity:        it.quantity,
    })),
  };
}

export type IngredientRecipeData = Awaited<ReturnType<typeof getIngredientRecipe>>;

// ─── Active ingredients (lightweight picker list) ─────────────────────────────

export async function getActiveIngredientsLite() {
  await requireRole("OWNER", "MANAGER");

  return prisma.ingredient.findMany({
    where:   { isActive: true },
    orderBy: { name: "asc" },
    select:  {
      id:              true,
      name:            true,
      baseUnit:        true,
      unitClass:       true,
      averageUnitCost: true,
    },
  });
}

// ─── Assembled-material index (for /admin/bahan/resep-olahan) ─────────────────

export async function getAssembledIngredientsIndex() {
  await requireRole("OWNER", "MANAGER");

  // (1) Ingredients that ARE assembled materials (have a recipe).
  const parents = await prisma.ingredient.findMany({
    where: { producedRecipe: { is: {} } },
    orderBy: { name: "asc" },
    select: {
      id:              true,
      name:            true,
      baseUnit:        true,
      unitClass:       true,
      currentStock:    true,
      averageUnitCost: true,
      producedRecipe:  {
        select: {
          yieldQty: true,
          items:    { select: { id: true } },
        },
      },
    },
  });

  // (2) Ingredients that are USED as components in at least one recipe.
  const componentRows = await prisma.ingredientRecipeItem.findMany({
    select: {
      ingredient: {
        select: { id: true, name: true, baseUnit: true, unitClass: true },
      },
      recipe: {
        select: { ingredient: { select: { id: true, name: true } } },
      },
    },
  });

  type CompAgg = {
    id: string;
    name: string;
    baseUnit: string;
    unitClass: "WEIGHT" | "VOLUME" | "COUNT";
    usedIn: { id: string; name: string }[];
  };
  const componentMap = new Map<string, CompAgg>();
  for (const row of componentRows) {
    const c = row.ingredient;
    const parent = row.recipe.ingredient;
    let agg = componentMap.get(c.id);
    if (!agg) {
      agg = {
        id: c.id, name: c.name, baseUnit: c.baseUnit,
        unitClass: c.unitClass as CompAgg["unitClass"],
        usedIn: [],
      };
      componentMap.set(c.id, agg);
    }
    if (!agg.usedIn.find((u) => u.id === parent.id)) agg.usedIn.push(parent);
  }

  return {
    parents: parents.map((p) => ({
      id:              p.id,
      name:            p.name,
      baseUnit:        p.baseUnit,
      unitClass:       p.unitClass,
      currentStock:    p.currentStock,
      averageUnitCost: p.averageUnitCost,
      yieldQty:        p.producedRecipe?.yieldQty ?? 0,
      componentCount:  p.producedRecipe?.items.length ?? 0,
    })),
    components: [...componentMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export type AssembledIngredientsIndex = Awaited<ReturnType<typeof getAssembledIngredientsIndex>>;

export type ActiveIngredientLite = Awaited<ReturnType<typeof getActiveIngredientsLite>>[number];

// ─── Unlinked past expense items (for linking history to a new ingredient) ────

export async function getUnlinkedExpenseItems() {
  await requireRole("OWNER", "MANAGER");

  const items = await prisma.expenseItem.findMany({
    where: {
      ingredientId: null,
      purchase:     { is: null },
    },
    select: {
      id:          true,
      description: true,
      amount:      true,
      cost:        true,
      unit:        true,
      expense:     { select: { recordedAt: true } },
    },
    orderBy: { expense: { recordedAt: "asc" } },
  });

  return items.map((i) => ({
    id:          i.id,
    description: i.description,
    amount:      i.amount,
    cost:        i.cost,
    unit:        i.unit,
    recordedAt:  i.expense.recordedAt,
  }));
}

export type UnlinkedExpenseItem = Awaited<ReturnType<typeof getUnlinkedExpenseItems>>[number];

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
