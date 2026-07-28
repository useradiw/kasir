import { prisma } from "@/lib/prisma";
import { localDateKey } from "@/lib/format";
import { sumDaySales, type DaySalesInput } from "@/lib/day-close";
import { SalesChannelRepository } from "@/lib/accounting/salesChannelRepository";
import { getNonSalesCashMovementByDate } from "./ledger-cash-queries";

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
 *   - nonSalesByDate: signed net ledger movement on the "tunai" kas account
 *     from everything EXCEPT the day-close posting itself (pengeluaran,
 *     transfer, modal, prive, saldo-awal, manual adjustments). Degrades to 0
 *     for any date when the "tunai" sales channel is unmapped — a query must
 *     never throw and break the cash-register screen.
 *
 * Used only by cash-register-queries.ts. report-queries.ts (laporan) keeps
 * its OWN inline reconciliation deliberately — it moves to the ledger in
 * Slice 3b, not here.
 */
export async function reconcileCashDates(dates: Date[]) {
  const cashByDate: Record<string, number> = {};
  const qrisByDate: Record<string, number> = {};
  const nonSalesByDate: Record<string, number> = {};

  if (dates.length === 0) return { cashByDate, qrisByDate, nonSalesByDate };

  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())) + 24 * 60 * 60 * 1000);

  const transactions = await prisma.transaction.findMany({
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
  }

  // Non-sales cash movement degrades to 0 (never throws) when "tunai" is
  // unmapped — the caller then falls back to openingCash + cashSales, same
  // as pre-ledger behaviour.
  try {
    const tunaiAccount = (await new SalesChannelRepository(prisma).list()).tunai;
    if (tunaiAccount) {
      const dateKeys = dates.map(localDateKey);
      const movement = await getNonSalesCashMovementByDate(tunaiAccount, dateKeys);
      Object.assign(nonSalesByDate, movement);
    }
  } catch {
    // A query must never break the screen — leave nonSalesByDate empty.
  }

  return { cashByDate, qrisByDate, nonSalesByDate };
}
