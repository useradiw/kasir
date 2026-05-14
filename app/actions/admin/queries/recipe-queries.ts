"use server";

import { Prisma } from "@/generated/prisma";
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
        menuItem: { select: { id: true, name: true, price: true } },
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

  // Get latest purchase cost per template for COGS calculation
  const templateIds = [...new Set(
    recipes.flatMap((r) => r.ingredients.map((i) => i.templateId).filter(Boolean) as string[])
  )];

  const costMap = new Map<string, number>();
  if (templateIds.length > 0) {
    const latestCosts = await prisma.$queryRaw<{ templateId: string; cost: number }[]>`
      SELECT DISTINCT ON ("templateId") "templateId", "cost"
      FROM "ExpenseItem" ei
      JOIN "Expense" e ON ei."expenseId" = e."id"
      WHERE ei."templateId" IN (${Prisma.join(templateIds)})
      ORDER BY "templateId", e."recordedAt" DESC
    `;
    for (const c of latestCosts) costMap.set(c.templateId, c.cost);
  }

  return {
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      defaultUnit: t.defaultUnit,
      defaultCost: t.defaultCost,
    })),
    recipes: recipes.map((r) => {
      const sellingPrice = r.menuItem.price + (r.variant?.priceModifier ?? 0);

      // Compute COGS from latest ingredient costs
      const cogs = r.ingredients.reduce((sum, ing) => {
        if (!ing.templateId) return sum;
        const unitCost = costMap.get(ing.templateId) ?? 0;
        return sum + ing.quantity * unitCost;
      }, 0);
      const cogsRounded = Math.round(cogs);
      const margin = sellingPrice > 0 ? ((sellingPrice - cogsRounded) / sellingPrice) * 100 : null;

      return {
        id: r.id,
        menuItemId: r.menuItemId,
        menuItemName: r.menuItem.name,
        sellingPrice,
        variantId: r.variantId,
        variantLabel: r.variant?.label ?? null,
        notes: r.notes,
        cogs: cogsRounded,
        marginPct: margin !== null ? Math.round(margin * 10) / 10 : null,
        ingredients: r.ingredients.map((i) => ({
          id: i.id,
          templateId: i.templateId,
          templateName: i.template?.name ?? null,
          templateUnit: i.template?.defaultUnit ?? null,
          templateCost: i.template?.defaultCost ?? null,
          latestCost: i.templateId ? (costMap.get(i.templateId) ?? 0) : 0,
          customName: i.customName,
          customUnit: i.customUnit,
          quantity: i.quantity,
        })),
      };
    }),
  };
}

export type RecipeData = Awaited<ReturnType<typeof getRecipeData>>;
