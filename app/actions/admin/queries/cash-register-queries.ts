"use server";

import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/admin-auth";
import { SalesChannelRepository } from "@/lib/accounting/salesChannelRepository";
import { reconcileCashDates, reconcileRegisterDay, resolveRegisterPostings } from "./_shared";

/** Resolves the "tunai" sales channel's kas account to a display label,
 *  matching the fallback getLedgerPengeluaranForPeriod already uses
 *  (label || last segment of the account name). Degrades to null — never
 *  throws — when the channel is unmapped, same as reconcileCashDates. */
async function resolveCashAccountLabel(): Promise<string | null> {
  try {
    const tunaiAccount = (await new SalesChannelRepository(prisma).list()).tunai;
    if (!tunaiAccount) return null;
    const account = await prisma.ledgerAccount.findUnique({
      where: { name: tunaiAccount },
      select: { label: true, name: true },
    });
    if (!account) return null;
    return account.label || account.name.split(":").pop() || null;
  } catch {
    return null;
  }
}

export async function getCashRegisterData(opts: { from: string; to: string }) {
  await requireCan("cashregister.read");

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

  const include = {
    openedBy: { select: { name: true } },
    closedBy: { select: { name: true } },
  };

  const [todayRegister, registers, cashAccountLabel] = await Promise.all([
    prisma.cashRegister.findUnique({ where: { date: startOfToday }, include }),
    prisma.cashRegister.findMany({ where, orderBy: { date: "desc" }, take: 50, include }),
    resolveCashAccountLabel(),
  ]);

  // Compute date range for reconciliation batch queries
  const allDates = registers.map((r) => r.date);
  if (todayRegister && !allDates.some((d) => d.getTime() === startOfToday.getTime())) {
    allDates.push(startOfToday);
  }

  const { cashByDate, qrisByDate, cashTxnCountByDate, nonSalesByDate, movementsByDate } =
    await reconcileCashDates(allDates);

  // Which closed registers already have a day-close (shift-close) posting —
  // backs the "unposted day" recovery badge/button on the admin screen.
  const registerIds = registers.map((r) => r.id);
  if (todayRegister) registerIds.push(todayRegister.id);
  const postings = await resolveRegisterPostings(registerIds);

  // Per-register math lives in the shared reconcileRegisterDay helper —
  // identical to what the staff tutup-kas view computes.
  const byDate = {
    cash: cashByDate,
    qris: qrisByDate,
    nonSales: nonSalesByDate,
    cashTxnCount: cashTxnCountByDate,
    movements: movementsByDate,
  };
  const reconcile = (r: { openingCash: number; closingCash: number | null; date: Date }) =>
    reconcileRegisterDay(r, byDate);

  const todayRecon = todayRegister ? reconcile(todayRegister) : null;
  const todayPosting = todayRegister ? postings.get(todayRegister.id) : undefined;

  return {
    cashAccountLabel,
    todayRegister: todayRegister
      ? {
          id: todayRegister.id,
          date: todayRegister.date.toISOString(),
          openingCash: todayRegister.openingCash,
          closingCash: todayRegister.closingCash,
          isOpen: todayRegister.closingCash === null,
          createdAt: todayRegister.createdAt.toISOString(),
          openedByName: todayRegister.openedBy?.name ?? null,
          closedByName: todayRegister.closedBy?.name ?? null,
          hasPosting:
            todayRegister.closingCash !== null
              ? (todayPosting?.posted ?? false) || (todayRecon?.nothingToPost ?? false)
              : null,
          journalNumber: todayPosting?.journalNumber ?? null,
        }
      : null,
    todayCashIncome: todayRecon?.cashIncome ?? 0,
    todayExpenses: todayRecon?.totalExpenses ?? 0,
    todayExpectedClosing: todayRecon?.expectedClosing ?? 0,
    todayQrisIncome: todayRecon?.qrisIncome ?? 0,
    todayCashTxnCount: todayRecon?.cashTxnCount ?? 0,
    todayMovements: todayRecon?.movements ?? [],
    registers: registers.map((r) => {
      const recon = reconcile(r);
      const posting = postings.get(r.id);
      return {
        id: r.id,
        date: r.date.toISOString(),
        openingCash: r.openingCash,
        closingCash: r.closingCash,
        cashIncome: recon.cashIncome,
        qrisIncome: recon.qrisIncome,
        totalExpenses: recon.totalExpenses,
        expectedClosing: recon.expectedClosing,
        difference: recon.difference,
        cashTxnCount: recon.cashTxnCount,
        movements: recon.movements,
        createdAt: r.createdAt.toISOString(),
        openedByName: r.openedBy?.name ?? null,
        closedByName: r.closedBy?.name ?? null,
        // null while open — a day-close posting only makes sense once closed.
        hasPosting: r.closingCash !== null ? (posting?.posted ?? false) || recon.nothingToPost : null,
        journalNumber: posting?.journalNumber ?? null,
      };
    }),
  };
}
