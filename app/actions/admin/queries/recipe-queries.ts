"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";

export async function getRecipeData() {
  await requireRole("OWNER", "MANAGER");

  const [templates, recipes] = await Promise.all([
    prisma.expenseTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, defaultUnit: true, defaultCost: true },
    }),
    prisma.recipe.findMany({
      include: {
        menuItem: { select: { id: true, name: true } },
        variant:  { select: { id: true, label: true, priceModifier: true } },
        ingredients: {
          include: {
            template: { select: { name: true, defaultUnit: true, defaultCost: true } },
          },
          orderBy: { id: "asc" },
        },
      },
      orderBy: [{ menuItem: { name: "asc" } }],
    }),
  ]);

  return {
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      defaultUnit: t.defaultUnit,
      defaultCost: t.defaultCost,
    })),
    recipes: recipes.map((r) => ({
      id: r.id,
      menuItemId: r.menuItemId,
      menuItemName: r.menuItem.name,
      variantId: r.variantId,
      variantLabel: r.variant?.label ?? null,
      notes: r.notes,
      ingredients: r.ingredients.map((i) => ({
        id: i.id,
        templateId: i.templateId,
        templateName: i.template?.name ?? null,
        templateUnit: i.template?.defaultUnit ?? null,
        templateCost: i.template?.defaultCost ?? null,
        customName: i.customName,
        customUnit: i.customUnit,
        quantity: i.quantity,
      })),
    })),
  };
}

export type RecipeData = Awaited<ReturnType<typeof getRecipeData>>;
