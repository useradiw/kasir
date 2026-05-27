"use server";

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";
import { runAction } from "@/lib/action-error";
import { revalidateOpname } from "@/lib/revalidate";

export async function getCurrentMonthOpnameStatus(): Promise<boolean> {
  await requireRole("OWNER", "MANAGER");
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const count = await prisma.stockOpname.count({
    where: { performedAt: { gte: start, lt: end } },
  });
  return count > 0;
}

export async function getOpnameHistory() {
  await requireRole("OWNER", "MANAGER");
  return prisma.stockOpname.findMany({
    orderBy: { performedAt: "desc" },
    take:    24,
    include: {
      performedBy: { select: { name: true } },
      lines: {
        include: { ingredient: { select: { name: true, baseUnit: true } } },
        orderBy: { ingredient: { name: "asc" } },
      },
    },
  });
}

export async function getOpnameIngredients() {
  await requireRole("OWNER", "MANAGER");
  return prisma.ingredient.findMany({
    where:   { isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id:           true,
      name:         true,
      category:     true,
      baseUnit:     true,
      currentStock: true,
    },
  });
}

export async function submitOpname(data: {
  notes?: string;
  lines: { ingredientId: string; countedQty: number }[];
}) {
  return runAction(async () => {
    const staff = await requireRole("OWNER", "MANAGER");

    await prisma.$transaction(async (tx) => {
      const opname = await tx.stockOpname.create({
        data: {
          performedById: staff.id,
          notes:         data.notes || null,
        },
      });

      // Prefetch all ingredient stocks + costs in 2 queries
      const ingredientIds = data.lines.map((l) => l.ingredientId);
      const ings = await tx.ingredient.findMany({
        where: { id: { in: ingredientIds } },
        select: { id: true, currentStock: true, averageUnitCost: true },
      });
      const ingMap = new Map(ings.map((i) => [i.id, i]));

      const opnameLineRows: { opnameId: string; ingredientId: string; systemQty: number; countedQty: number; delta: number }[] = [];
      const logRows: { ingredientId: string; type: "ADJUSTMENT"; quantity: number; unitCost: number; referenceId: string; note: string }[] = [];
      const purchaseRows: Prisma.IngredientPurchaseCreateManyInput[] = [];
      const stockUpdates: { id: string; countedQty: number }[] = [];

      for (const line of data.lines) {
        const ing = ingMap.get(line.ingredientId);
        if (!ing) continue;

        const systemQty  = ing.currentStock;
        const countedQty = line.countedQty;
        const delta      = countedQty - systemQty;

        opnameLineRows.push({
          opnameId:     opname.id,
          ingredientId: line.ingredientId,
          systemQty,
          countedQty,
          delta,
        });

        if (delta !== 0) {
          const avgCost = ing.averageUnitCost;
          logRows.push({
            ingredientId: line.ingredientId,
            type:         "ADJUSTMENT",
            quantity:     delta,
            unitCost:     avgCost,
            referenceId:  opname.id,
            note:         delta > 0 ? "Opname gain" : "Opname shrinkage",
          });
          stockUpdates.push({ id: line.ingredientId, countedQty });

          if (delta > 0) {
            const totalCost = Math.round(delta * avgCost);
            purchaseRows.push({
              ingredientId:     line.ingredientId,
              source:           "OPNAME_GAIN",
              packQty:          delta,
              baseQty:          delta,
              totalCost,
              unitCost:         avgCost,
              avgUnitCostAfter: avgCost,
              stockAfter:       countedQty,
              purchasedAt:      new Date(),
              notes:            "Opname gain",
            });
          }
        }
      }

      // Batch writes
      await tx.stockOpnameLine.createMany({ data: opnameLineRows });
      if (logRows.length > 0) await tx.ingredientLog.createMany({ data: logRows });
      if (purchaseRows.length > 0) await tx.ingredientPurchase.createMany({ data: purchaseRows });
      for (const u of stockUpdates) {
        await tx.ingredient.update({ where: { id: u.id }, data: { currentStock: u.countedQty } });
      }
    });

    revalidateOpname();
  });
}
