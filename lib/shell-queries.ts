import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma";
import { reconcileCashDates, reconcileRegisterDay } from "@/app/actions/admin/queries/_shared";
import { CashAccountRepository } from "@/lib/accounting/cashAccountRepository";
import { SalesChannelRepository, SALES_CHANNELS } from "@/lib/accounting/salesChannelRepository";
import { monthLockBoundary } from "@/lib/accounting/monthLock";
import { localDateKey } from "@/lib/format";
import { disbursedTotal, offlineSalesTotal, recognisedRevenue } from "@/lib/revenue";
import { isOnlineService } from "@/lib/day-close";

/**
 * Data for the unified tabs (Beranda / Buku) — docs/redesign/SPEC.md.
 * Deliberately NOT a "use server" file: these are page-scoped queries, and
 * exporting them from an actions file would expose ungated read endpoints.
 * Pages gate with requireAuth/requireRole before calling.
 */

export interface UnpostedDayClose {
  id: string;
  date: Date;
  closingCash: number;
  reason: string | null;
}

/**
 * Why a closed day never reached the buku besar, when that is knowable. The
 * screen used to assert "bulan terkunci" for every case, which is wrong during
 * setup — an unmapped sales channel is the far more common cause.
 */
export function unpostedReason(
  dateKey: string,
  lockBoundary: string | null,
  unmappedChannels: string[],
): string | null {
  if (unmappedChannels.length > 0) {
    return `Akun penjualan belum dipetakan: ${unmappedChannels.join(", ")}.`;
  }
  if (lockBoundary && dateKey <= lockBoundary) {
    return "Bulan itu sudah dikunci — buka dulu bulannya.";
  }
  return null;
}

/**
 * Closed register days with no LedgerPosting row — the recovery list.
 *
 * A day with no sales AND an exact cash count posts nothing on purpose, so it
 * has no LedgerPosting and never will. Such a day is NOT unposted; flagging it
 * would leave a warning on Beranda and Buku that no button can ever clear.
 * That is why this reuses reconcileRegisterDay's nothingToPost — the same rule
 * /admin/cash-register applies — instead of re-deriving the condition.
 */
export async function getUnpostedDayCloses(
  limit = 5,
  db: PrismaClient = prisma,
): Promise<UnpostedDayClose[]> {
  const registers = await db.cashRegister.findMany({
    where: { closingCash: { not: null } },
    orderBy: { date: "desc" },
    take: 60,
    select: { id: true, date: true, closingCash: true, openingCash: true },
  });
  if (registers.length === 0) return [];

  const postings = await db.ledgerPosting.findMany({
    where: { sourceType: "shift-close", sourceId: { in: registers.map((r) => r.id) } },
    select: { sourceId: true },
  });
  const posted = new Set(postings.map((p) => p.sourceId));
  const candidates = registers.filter((r) => !posted.has(r.id));
  if (candidates.length === 0) return [];

  const raw = await reconcileCashDates(candidates.map((r) => r.date), db);
  const byDate = { cash: raw.cashByDate, qris: raw.qrisByDate, nonSales: raw.nonSalesByDate };
  const unposted = candidates
    .filter((r) => !reconcileRegisterDay(r, byDate).nothingToPost)
    .slice(0, limit);
  if (unposted.length === 0) return [];

  const [lockBoundary, channels] = await Promise.all([
    monthLockBoundary(db),
    new SalesChannelRepository(db).list(),
  ]);
  const unmapped = SALES_CHANNELS.filter((c) => !channels[c]);

  return unposted.map((r) => ({
    id: r.id,
    date: r.date,
    closingCash: r.closingCash as number,
    reason: unpostedReason(localDateKey(r.date), lockBoundary, unmapped),
  }));
}

export interface TodayOverview {
  salesToday: number;
  txnsToday: number;
  qrisToday: number;
  salesYesterday: number;
  openRegister: {
    id: string;
    openingCash: number;
    expectedClosing: number;
    cashIncome: number;
  } | null;
}

/**
 * Figures for the Beranda bento.
 *
 * Pendapatan follows lib/revenue.ts — the same definition /admin/reports has
 * always used. Summing every PAID transaction instead would count a GoFood
 * order the moment it is taken, at its gross value, so the home screen would
 * read higher than both the reports screen and laporan by the commission and
 * by everything not yet disbursed.
 */
export async function getTodayOverview(db: PrismaClient = prisma): Promise<TodayOverview> {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const yesterdayStart = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000);

  const select = {
    id: true,
    totalAmount: true,
    qrisAmount: true,
    paidAt: true,
    tableSession: { select: { service: true } },
  } as const;

  const [todayTx, yesterdayTx, openRegisterRow] = await Promise.all([
    db.transaction.findMany({
      where: { status: "PAID", paidAt: { gte: dayStart, lt: dayEnd } },
      select,
    }),
    db.transaction.findMany({
      where: { status: "PAID", paidAt: { gte: yesterdayStart, lt: dayStart } },
      select,
    }),
    db.cashRegister.findFirst({
      where: { date: { gte: dayStart, lt: dayEnd }, closingCash: null },
      orderBy: { date: "desc" },
    }),
  ]);

  const shape = (txs: typeof todayTx) =>
    txs.map((t) => ({ id: t.id, totalAmount: t.totalAmount, service: t.tableSession.service }));

  const [todayDisbursed, yesterdayDisbursed] = await Promise.all([
    sumDisbursedFor(shape(todayTx), db),
    sumDisbursedFor(shape(yesterdayTx), db),
  ]);

  let openRegister: TodayOverview["openRegister"] = null;
  if (openRegisterRow) {
    const raw = await reconcileCashDates([openRegisterRow.date], db);
    const byDate = { cash: raw.cashByDate, qris: raw.qrisByDate, nonSales: raw.nonSalesByDate };
    const recon = reconcileRegisterDay(openRegisterRow, byDate);
    openRegister = {
      id: openRegisterRow.id,
      openingCash: openRegisterRow.openingCash,
      expectedClosing: recon.expectedClosing,
      cashIncome: recon.cashIncome,
    };
  }

  const offlineToday = shape(todayTx);
  return {
    salesToday: recognisedRevenue(offlineSalesTotal(offlineToday), todayDisbursed),
    // Transaction count stays the count of sales taken today, online included:
    // it describes activity, not money.
    txnsToday: todayTx.length,
    qrisToday: todayTx.reduce((sum, t) => sum + t.qrisAmount, 0),
    salesYesterday: recognisedRevenue(offlineSalesTotal(shape(yesterdayTx)), yesterdayDisbursed),
    openRegister,
  };
}

/** Settlements covering these orders, counted once each (lib/revenue.ts). */
async function sumDisbursedFor(
  txs: { id: string; service: string | null }[],
  db: PrismaClient,
): Promise<number> {
  const onlineIds = txs.filter((t) => isOnlineService(t.service)).map((t) => t.id);
  if (onlineIds.length === 0) return 0;
  const items = await db.settlementItem.findMany({
    where: { transactionId: { in: onlineIds } },
    select: { settlementId: true, settlement: { select: { finalAmount: true } } },
  });
  return disbursedTotal(items);
}

/** Sales made by one cashier today (their own shift card on Beranda). */
export async function getStaffSalesToday(
  staffId: string,
  db: PrismaClient = prisma,
): Promise<{ salesToday: number; txnsToday: number }> {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const agg = await db.transaction.aggregate({
    where: { status: "PAID", paidAt: { gte: dayStart, lt: dayEnd }, processedById: staffId },
    _sum: { totalAmount: true },
    _count: true,
  });
  return { salesToday: agg._sum.totalAmount ?? 0, txnsToday: agg._count ?? 0 };
}

export interface BukuSetupStatus {
  accountsSeeded: boolean;
  cashAccountsCount: number;
  channels: Record<string, string | null>;
  categoriesCount: number;
}

/** Which of the blocking setup steps (UAT checklist) are still missing. */
export async function getBukuSetupStatus(db: PrismaClient = prisma): Promise<BukuSetupStatus> {
  const [accounts, cashAccounts, channels, categories] = await Promise.all([
    db.ledgerAccount.count(),
    new CashAccountRepository(db).list(),
    new SalesChannelRepository(db).list(),
    db.expenseCategory.count(),
  ]);
  return {
    accountsSeeded: accounts > 0,
    cashAccountsCount: cashAccounts.length,
    channels,
    categoriesCount: categories,
  };
}

/** Human checklist derived from the raw status — mirrors the UAT ordering. */
export function setupSteps(status: BukuSetupStatus): {
  done: boolean;
  label: string;
  detail: string;
}[] {
  const unmapped = SALES_CHANNELS.filter((c) => !status.channels[c]);
  return [
    {
      done: status.accountsSeeded,
      label: "Isi akun default",
      detail: "Struktur buku besar terisi otomatis.",
    },
    {
      done: status.cashAccountsCount > 0,
      label: "Buat akun kas",
      detail:
        status.cashAccountsCount > 0
          ? `${status.cashAccountsCount} akun kas siap.`
          : "Belum ada akun kas — kamu yang mendefinisikan.",
    },
    {
      done: unmapped.length === 0,
      label: "Petakan akun penjualan",
      detail:
        unmapped.length === 0
          ? "Tunai, elektronik, online — semua terpetakan."
          : `Belum dipetakan: ${unmapped.join(", ")}.`,
    },
    {
      done: status.categoriesCount > 0,
      label: "Isi kategori pengeluaran",
      detail:
        status.categoriesCount > 0
          ? `${status.categoriesCount} kategori siap.`
          : "Belum ada kategori.",
    },
  ];
}
