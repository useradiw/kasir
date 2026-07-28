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

  const { cashByDate, qrisByDate, nonSalesByDate } = await reconcileCashDates(allDates);

  // Which closed registers already have a day-close (shift-close) posting —
  // backs the "unposted day" recovery badge/button on the admin screen.
  const registerIds = registers.map((r) => r.id);
  if (todayRegister) registerIds.push(todayRegister.id);
  const postings = registerIds.length
    ? await prisma.ledgerPosting.findMany({
        where: { sourceType: "shift-close", sourceId: { in: registerIds } },
        select: { sourceId: true },
      })
    : [];
  const postedIds = new Set(postings.map((p) => p.sourceId));

  // expectedClosing = openingCash + cashSales + nonSalesCashMovement (signed:
  // negative for pengeluaran, positive for a transfer/modal INTO the drawer).
  // totalExpenses keeps its old field name/shape for existing clients — it's
  // now just "money out" read off the ledger: -min(0, nonSalesCashMovement).
  function reconcile(r: { openingCash: number; closingCash: number | null; date: Date }) {
    const key = localDateKey(r.date);
    const cashIncome = cashByDate[key] ?? 0;
    const qrisIncome = qrisByDate[key] ?? 0;
    const nonSalesCashMovement = nonSalesByDate[key] ?? 0;
    const totalExpenses = Math.max(0, -nonSalesCashMovement);
    const expectedClosing = r.openingCash + cashIncome + nonSalesCashMovement;
    const difference = r.closingCash !== null ? r.closingCash - expectedClosing : null;
    // A day with no sales AND an exact cash count is not a ledger event —
    // postDayClose deliberately returns null and writes nothing. Such a day must
    // NOT be flagged "belum tercatat" forever, so treat it as nothing-to-post.
    const nothingToPost = cashIncome === 0 && qrisIncome === 0 && (difference ?? 0) === 0;
    return { cashIncome, totalExpenses, expectedClosing, difference, nothingToPost };
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
          hasPosting:
            todayRegister.closingCash !== null
              ? postedIds.has(todayRegister.id) || (todayRecon?.nothingToPost ?? false)
              : null,
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
        // null while open — a day-close posting only makes sense once closed.
        hasPosting:
          r.closingCash !== null ? postedIds.has(r.id) || recon.nothingToPost : null,
      };
    }),
  };
}
