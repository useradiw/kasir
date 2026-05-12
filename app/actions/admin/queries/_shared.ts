import { prisma } from "@/lib/prisma";
import { localDateKey } from "@/lib/format";
import { computeExpenseTotal } from "@/lib/expense-utils";

/**
 * Batch-fetch CASH transactions and cash-deducted expenses for a set of dates,
 * then bucket totals by local date key.
 * Used by both cash-register and report queries to avoid duplication.
 */
export async function reconcileCashDates(dates: Date[]) {
  const cashByDate: Record<string, number> = {};
  const expenseByDate: Record<string, number> = {};

  if (dates.length === 0) return { cashByDate, expenseByDate };

  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())) + 24 * 60 * 60 * 1000);

  const [transactions, expenses] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        status: "PAID",
        paymentMethod: "CASH",
        paidAt: { gte: minDate, lt: maxDate },
      },
      select: { totalAmount: true, paidAt: true },
    }),
    prisma.expense.findMany({
      where: { recordedAt: { gte: minDate, lt: maxDate }, deductFromCash: true },
      include: { items: { select: { amount: true, cost: true } } },
    }),
  ]);

  for (const t of transactions) {
    const key = localDateKey(t.paidAt);
    cashByDate[key] = (cashByDate[key] ?? 0) + t.totalAmount;
  }
  for (const e of expenses) {
    const key = localDateKey(e.recordedAt);
    expenseByDate[key] = (expenseByDate[key] ?? 0) + computeExpenseTotal(e.items);
  }

  return { cashByDate, expenseByDate };
}
