"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";

// ─── Ingredient stock page ────────────────────────────────────────────────────

export async function getIngredientStockData() {
  await requireRole("OWNER", "MANAGER");

  const templates = await prisma.expenseTemplate.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      defaultUnit: true,
      defaultCost: true,
      currentStock: true,
      lowStockAlert: true,
      isActive: true,
    },
  });

  // Latest purchase cost per template (for display)
  const latestCosts = await Promise.all(
    templates.map(async (t) => {
      const latest = await prisma.expenseItem.findFirst({
        where: { templateId: t.id },
        orderBy: { expense: { recordedAt: "desc" } },
        select: { cost: true, expense: { select: { recordedAt: true } } },
      });
      return { templateId: t.id, latestCost: latest?.cost ?? null, lastPurchasedAt: latest?.expense.recordedAt ?? null };
    }),
  );

  const costMap = new Map(latestCosts.map((c) => [c.templateId, c]));

  return templates.map((t) => {
    const costInfo = costMap.get(t.id);
    return {
      id: t.id,
      name: t.name,
      unit: t.defaultUnit,
      currentStock: t.currentStock,
      lowStockAlert: t.lowStockAlert,
      isActive: t.isActive,
      latestCost: costInfo?.latestCost ?? null,
      lastPurchasedAt: costInfo?.lastPurchasedAt ?? null,
      isLow: t.lowStockAlert !== null && t.currentStock <= t.lowStockAlert,
    };
  });
}

export type IngredientStockData = Awaited<ReturnType<typeof getIngredientStockData>>;

// ─── Ingredient log history ───────────────────────────────────────────────────

export async function getIngredientLogs(templateId: string, limit = 50) {
  await requireRole("OWNER", "MANAGER");

  const logs = await prisma.ingredientLog.findMany({
    where: { templateId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      quantity: true,
      unitCost: true,
      referenceId: true,
      note: true,
      createdAt: true,
    },
  });

  return logs;
}

export type IngredientLog = Awaited<ReturnType<typeof getIngredientLogs>>[number];

// ─── Manual stock adjustment ──────────────────────────────────────────────────

export async function adjustIngredientStock(
  templateId: string,
  quantity: number,
  note: string,
): Promise<void> {
  await requireRole("OWNER", "MANAGER");

  if (quantity === 0) throw new Error("Jumlah penyesuaian tidak boleh 0");

  // Get current cost for reference
  const latest = await prisma.expenseItem.findFirst({
    where: { templateId },
    orderBy: { expense: { recordedAt: "desc" } },
    select: { cost: true },
  });
  const unitCost = latest?.cost ?? 0;

  await prisma.$transaction(async (tx) => {
    await tx.ingredientLog.create({
      data: {
        templateId,
        type: quantity > 0 ? "PURCHASE" : "ADJUSTMENT",
        quantity,
        unitCost,
        note: note.trim() || null,
      },
    });

    if (quantity > 0) {
      await tx.expenseTemplate.update({
        where: { id: templateId },
        data: { currentStock: { increment: quantity } },
      });
    } else {
      await tx.expenseTemplate.update({
        where: { id: templateId },
        data: { currentStock: { decrement: -quantity } },
      });
    }
  });
}

// ─── Low stock alert threshold ────────────────────────────────────────────────

export async function setLowStockAlert(
  templateId: string,
  threshold: number | null,
): Promise<void> {
  await requireRole("OWNER", "MANAGER");

  await prisma.expenseTemplate.update({
    where: { id: templateId },
    data: { lowStockAlert: threshold },
  });
}
