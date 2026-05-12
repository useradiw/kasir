"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";
import { localDateKey } from "@/lib/format";
import { reconcileCashDates } from "./_shared";

export async function getCashRegisterData(opts: { from: string; to: string }) {
  await requireRole("OWNER", "MANAGER");

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Date filter for history
  const where: { date?: { gte?: Date; lt?: Date } } = {};
  if (opts.from || opts.to) {
    where.date = {};
    if (opts.from) where.date.gte = new Date(opts.from);
    if (opts.to) {
      const toDate = new Date(opts.to);
      toDate.setDate(toDate.getDate() + 1);
      where.date.lt = toDate;
    }
  }

  const [todayRegister, registers] = await Promise.all([
    prisma.cashRegister.findUnique({ where: { date: startOfToday } }),
    prisma.cashRegister.findMany({ where, orderBy: { date: "desc" }, take: 50 }),
  ]);

  // Compute date range for reconciliation batch queries
  const allDates = registers.map((r) => r.date);
  if (todayRegister && !allDates.some((d) => d.getTime() === startOfToday.getTime())) {
    allDates.push(startOfToday);
  }

  const { cashByDate, expenseByDate } = await reconcileCashDates(allDates);

  function reconcile(r: { openingCash: number; closingCash: number | null; date: Date }) {
    const key = localDateKey(r.date);
    const cashIncome = cashByDate[key] ?? 0;
    const totalExpenses = expenseByDate[key] ?? 0;
    const expectedClosing = r.openingCash + cashIncome - totalExpenses;
    const difference = r.closingCash !== null ? r.closingCash - expectedClosing : null;
    return { cashIncome, totalExpenses, expectedClosing, difference };
  }

  const todayRecon = todayRegister ? reconcile(todayRegister) : null;

  return {
    todayRegister: todayRegister
      ? {
          id: todayRegister.id,
          date: todayRegister.date.toISOString(),
          openingCash: todayRegister.openingCash,
          closingCash: todayRegister.closingCash,
          isOpen: todayRegister.closingCash === null,
        }
      : null,
    todayCashIncome: todayRecon?.cashIncome ?? 0,
    todayExpenses: todayRecon?.totalExpenses ?? 0,
    todayExpectedClosing: todayRecon?.expectedClosing ?? 0,
    registers: registers.map((r) => {
      const recon = reconcile(r);
      return {
        id: r.id,
        date: r.date.toISOString(),
        openingCash: r.openingCash,
        closingCash: r.closingCash,
        cashIncome: recon.cashIncome,
        totalExpenses: recon.totalExpenses,
        expectedClosing: recon.expectedClosing,
        difference: recon.difference,
      };
    }),
  };
}
