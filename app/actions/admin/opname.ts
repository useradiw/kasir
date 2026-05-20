"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";
import { runAction } from "@/lib/action-error";
import { revalidateOpname } from "@/lib/revalidate";
import { recordOpnameLine } from "@/lib/cogs-utils";

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

      for (const line of data.lines) {
        const ing = await tx.ingredient.findUnique({
          where:  { id: line.ingredientId },
          select: { currentStock: true },
        });
        if (!ing) continue;

        const systemQty  = ing.currentStock;
        const countedQty = line.countedQty;
        const delta      = countedQty - systemQty;

        await tx.stockOpnameLine.create({
          data: {
            opnameId:     opname.id,
            ingredientId: line.ingredientId,
            systemQty,
            countedQty,
            delta,
          },
        });

        await recordOpnameLine(tx, line.ingredientId, systemQty, countedQty, opname.id);
      }
    });

    revalidateOpname();
  });
}
