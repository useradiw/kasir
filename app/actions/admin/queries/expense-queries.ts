"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";
import { computeExpenseTotal } from "@/lib/expense-utils";

export async function getExpensesData(opts: { from: string; to: string }) {
  await requireRole("OWNER", "MANAGER");

  const where: { recordedAt?: { gte?: Date; lt?: Date } } = {};
  if (opts.from || opts.to) {
    where.recordedAt = {};
    if (opts.from) where.recordedAt.gte = new Date(opts.from);
    if (opts.to) {
      const toDate = new Date(opts.to);
      toDate.setDate(toDate.getDate() + 1);
      where.recordedAt.lt = toDate;
    }
  }

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { recordedAt: "desc" },
    take: 50,
    include: { items: true, staff: { select: { name: true } } },
  });

  const mapped = expenses.map((e) => {
    const items = e.items.map((i) => ({
      id: i.id,
      description: i.description,
      amount: i.amount,
      cost: i.cost,
      unit: i.unit,
      templateId: i.templateId,
    }));
    return {
      id: e.id,
      description: e.description,
      deductFromCash: e.deductFromCash,
      countToKasPakHar: e.countToKasPakHar,
      recordedAt: e.recordedAt.toISOString(),
      createdAt: e.createdAt.toISOString(),
      staffName: e.staff?.name ?? null,
      items,
    };
  });

  const totalAmount = mapped.reduce(
    (sum, e) => sum + computeExpenseTotal(e.items),
    0,
  );

  return { expenses: mapped, totalAmount };
}
