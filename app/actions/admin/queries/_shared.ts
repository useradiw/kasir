import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma";
import { localDateKey } from "@/lib/format";
import { sumDaySales, type DaySalesInput } from "@/lib/day-close";
import { SalesChannelRepository } from "@/lib/accounting/salesChannelRepository";
import {
  getNonSalesCashMovementByDate,
  getNonSalesCashMovementLines,
  type CashMovementLine,
} from "@/lib/ledger-queries";

// ─── Date Range Helper ──────────────────────────────────────────────────────

export type Period = "daily" | "weekly" | "monthly" | "yearly";

export function getDateRange(period: Period, dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const base = new Date(y, m - 1, d);

  if (period === "daily") {
    return { start: new Date(y, m - 1, d), end: new Date(y, m - 1, d + 1) };
  }
  if (period === "weekly") {
    const day = base.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(y, m - 1, d + diff);
    return { start: monday, end: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7) };
  }
  if (period === "yearly") {
    return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
  }
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

/**
 * Batch-fetch PAID transactions for a set of dates and reduce them to
 * cash-register reconciliation figures per local date key:
 *   - cashByDate: tunai received into the drawer (sumDaySales' cashSales —
 *     online-service transactions excluded, split legs split correctly).
 *   - cashTxnCountByDate: sumDaySales' cashTxnCount — how many transactions
 *     made up cashByDate for that date, for the Kas screen's "N transaksi" sub.
 *   - nonSalesByDate: signed net ledger movement on the "tunai" kas account
 *     from everything EXCEPT the day-close posting itself (pengeluaran,
 *     transfer, modal, prive, saldo-awal, manual adjustments). Degrades to 0
 *     for any date when the "tunai" sales channel is unmapped — a query must
 *     never throw and break the cash-register screen.
 *   - movementsByDate: the individual journal lines behind nonSalesByDate,
 *     for the Kas screen's movements list. Same degrade-to-empty rule.
 *
 * Used only by cash-register-queries.ts. report-queries.ts (laporan) keeps
 * its OWN inline reconciliation deliberately — it moves to the ledger in
 * Slice 3b, not here.
 */
export async function reconcileCashDates(dates: Date[], db: PrismaClient = prisma) {
  const cashByDate: Record<string, number> = {};
  const qrisByDate: Record<string, number> = {};
  const cashTxnCountByDate: Record<string, number> = {};
  const nonSalesByDate: Record<string, number> = {};
  const movementsByDate: Record<string, CashMovementLine[]> = {};

  if (dates.length === 0) {
    return { cashByDate, qrisByDate, cashTxnCountByDate, nonSalesByDate, movementsByDate };
  }

  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())) + 24 * 60 * 60 * 1000);

  const transactions = await db.transaction.findMany({
    where: {
      status: "PAID",
      paidAt: { gte: minDate, lt: maxDate },
    },
    select: {
      paymentMethod: true,
      cashAmount: true,
      qrisAmount: true,
      totalAmount: true,
      paidAt: true,
      tableSession: { select: { service: true } },
    },
  });

  const byDate = new Map<string, DaySalesInput[]>();
  for (const t of transactions) {
    const key = localDateKey(t.paidAt);
    const list = byDate.get(key) ?? [];
    list.push({
      paymentMethod: t.paymentMethod,
      cashAmount: t.cashAmount,
      qrisAmount: t.qrisAmount,
      totalAmount: t.totalAmount,
      service: t.tableSession.service,
    });
    byDate.set(key, list);
  }
  for (const [key, txs] of byDate) {
    const totals = sumDaySales(txs);
    cashByDate[key] = totals.cashSales;
    qrisByDate[key] = totals.qrisSales;
    cashTxnCountByDate[key] = totals.cashTxnCount;
  }

  // Non-sales cash movement degrades to 0/empty (never throws) when "tunai"
  // is unmapped — the caller then falls back to openingCash + cashSales,
  // same as pre-ledger behaviour.
  try {
    const tunaiAccount = (await new SalesChannelRepository(db).list()).tunai;
    if (tunaiAccount) {
      const dateKeys = dates.map(localDateKey);
      const [movement, lines] = await Promise.all([
        getNonSalesCashMovementByDate(tunaiAccount, dateKeys, db),
        getNonSalesCashMovementLines(tunaiAccount, dateKeys, db),
      ]);
      Object.assign(nonSalesByDate, movement);
      Object.assign(movementsByDate, lines);
    }
  } catch {
    // A query must never break the screen — leave nonSalesByDate/movementsByDate empty.
  }

  return { cashByDate, qrisByDate, cashTxnCountByDate, nonSalesByDate, movementsByDate };
}

/**
 * Per-register reconciliation math shared by the staff (tutup kas) and admin
 * (Kas Harian) screens. Was copy-pasted in both action files and had already
 * diverged — the staff copy was missing qrisIncome and nothingToPost.
 *
 * expectedClosing = openingCash + cashSales + nonSalesCashMovement (signed:
 * negative for pengeluaran, positive for a transfer/modal INTO the drawer).
 * totalExpenses keeps its old field name/shape for existing clients — it's
 * just "money out" read off the ledger: -min(0, nonSalesCashMovement).
 */
export function reconcileRegisterDay(
  r: { openingCash: number; closingCash: number | null; date: Date },
  byDate: {
    cash: Record<string, number>;
    qris: Record<string, number>;
    nonSales: Record<string, number>;
    cashTxnCount?: Record<string, number>;
    movements?: Record<string, CashMovementLine[]>;
  },
) {
  const key = localDateKey(r.date);
  const cashIncome = byDate.cash[key] ?? 0;
  const qrisIncome = byDate.qris[key] ?? 0;
  const nonSalesCashMovement = byDate.nonSales[key] ?? 0;
  const cashTxnCount = byDate.cashTxnCount?.[key] ?? 0;
  const movements = byDate.movements?.[key] ?? [];
  const totalExpenses = Math.max(0, -nonSalesCashMovement);
  const expectedClosing = r.openingCash + cashIncome + nonSalesCashMovement;
  const difference = r.closingCash !== null ? r.closingCash - expectedClosing : null;
  // A day with no sales AND an exact cash count is not a ledger event —
  // postDayClose deliberately returns null and writes nothing. Such a day must
  // NOT be flagged "belum tercatat" forever, so treat it as nothing-to-post.
  const nothingToPost = cashIncome === 0 && qrisIncome === 0 && (difference ?? 0) === 0;
  return {
    cashIncome,
    qrisIncome,
    totalExpenses,
    expectedClosing,
    difference,
    nothingToPost,
    cashTxnCount,
    movements,
  };
}

/**
 * Resolves which of `registerIds` already have a day-close (shift-close)
 * ledger posting, plus that posting's human journal number — shared by the
 * owner (getCashRegisterData) and staff (getCashRegisterDataForStaff) Kas
 * queries (task A3), which previously each ran their own findMany for this.
 * The "nothingToPost" combination (a day with no sales and an exact count
 * has no posting by design, and is not "unposted") stays a decision each
 * caller makes with reconcileRegisterDay's result — this helper only reports
 * what the ledger actually has.
 */
export async function resolveRegisterPostings(
  registerIds: string[],
  db: PrismaClient = prisma,
): Promise<Map<string, { posted: boolean; journalNumber: number | null }>> {
  const result = new Map<string, { posted: boolean; journalNumber: number | null }>();
  if (registerIds.length === 0) return result;

  const postings = await db.ledgerPosting.findMany({
    where: { sourceType: "shift-close", sourceId: { in: registerIds } },
    select: { sourceId: true, journalEntryId: true },
  });
  if (postings.length === 0) return result;

  const entries = await db.journalEntry.findMany({
    where: { id: { in: postings.map((p) => p.journalEntryId) } },
    select: { id: true, number: true },
  });
  const numberById = new Map(entries.map((e) => [e.id, e.number]));

  for (const p of postings) {
    result.set(p.sourceId, { posted: true, journalNumber: numberById.get(p.journalEntryId) ?? null });
  }
  return result;
}
