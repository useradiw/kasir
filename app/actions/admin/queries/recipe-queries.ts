"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";

export async function getRecipeData() {
  await requireRole("OWNER", "MANAGER");

  const [ingredients, recipes] = await Promise.all([
    prisma.ingredient.findMany({
      where:   { isActive: true },
      orderBy: { name: "asc" },
      select:  { id: true, name: true, baseUnit: true, averageUnitCost: true, lastUnitCost: true, category: true },
    }),
    prisma.recipe.findMany({
      include: {
        menuItem: { select: { id: true, name: true, price: true } },
        variant:  { select: { id: true, label: true, priceModifier: true } },
        ingredients: {
          include: {
            ingredient: { select: { name: true, baseUnit: true, averageUnitCost: true, lastUnitCost: true } },
          },
          orderBy: { id: "asc" },
        },
      },
      orderBy: [{ menuItem: { name: "asc" } }],
    }),
  ]);

  // Build cost map from Ingredient.averageUnitCost (O(1) per ingredient — no raw SQL needed)
  const ingMap = new Map(ingredients.map((i) => [i.id, i]));

  return {
    ingredients: ingredients.map((i) => ({
      id:              i.id,
      name:            i.name,
      baseUnit:        i.baseUnit,
      averageUnitCost: i.averageUnitCost,
      category:        i.category,
    })),
    recipes: recipes.map((r) => {
      const sellingPrice = r.menuItem.price + (r.variant?.priceModifier ?? 0);

      const cogs = r.ingredients.reduce((sum, ing) => {
        const ingId = ing.ingredientId ?? ing.templateId;
        if (!ingId) return sum;
        const ingRow = ing.ingredient ?? ingMap.get(ingId);
        const unitCost = ingRow?.averageUnitCost ?? 0;
        return sum + ing.quantity * unitCost;
      }, 0);

      const cogsRounded = Math.round(cogs);
      const margin = sellingPrice > 0 ? ((sellingPrice - cogsRounded) / sellingPrice) * 100 : null;

      return {
        id:           r.id,
        menuItemId:   r.menuItemId,
        menuItemName: r.menuItem.name,
        sellingPrice,
        variantId:    r.variantId,
        variantLabel: r.variant?.label ?? null,
        notes:        r.notes,
        cogs:         cogsRounded,
        marginPct:    margin !== null ? Math.round(margin * 10) / 10 : null,
        ingredients: r.ingredients.map((i) => {
          const ingId  = i.ingredientId ?? i.templateId;
          const ingRow = i.ingredient ?? (ingId ? ingMap.get(ingId) : null);
          return {
            id:              i.id,
            ingredientId:    ingId,
            ingredientName:  ingRow?.name ?? i.customName ?? null,
            ingredientUnit:  ingRow?.baseUnit ?? i.customUnit ?? null,
            averageUnitCost: ingRow?.averageUnitCost ?? 0,
            lastUnitCost:    ingRow?.lastUnitCost ?? null,
            customName:      i.customName,
            customUnit:      i.customUnit,
            quantity:        i.quantity,
          };
        }),
      };
    }),
  };
}

export type RecipeData = Awaited<ReturnType<typeof getRecipeData>>;
