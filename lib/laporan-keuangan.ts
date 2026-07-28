/**
 * laporan-keuangan.ts — Slice 4 Laporan Keuangan (financial statements).
 *
 * Ported from tokokencana's lib/queries/keuangan.ts (getLaporanKeuangan),
 * adapted for kasir in two places:
 *
 * 1. Neraca asset labels: the donor's balanceSheet() labels lines with the
 *    hardcoded CASH_LABELS map (tokokencana's 3 fixed accounts). kasir's kas
 *    accounts are user-created (CashAccountRepository), so every line would
 *    otherwise render as a raw Beancount name ("Assets:Cash:KasLaci"). Fixed
 *    here by POST-PROCESSING the returned neraca.aset.lines with a name->label
 *    lookup against the LedgerAccount registry (falling back to the name's
 *    last segment when label is null — same fallback the schema comment and
 *    getLedgerPengeluaranForPeriod already use). balanceSheet() itself is
 *    untouched.
 * 2. getSaleTotals reads kasir's OWN source tables (Transaction +
 *    OnlineSettlement), not tokokencana's kasirTransaction/order — see its
 *    doc comment below.
 *
 * Every export takes an optional `db: PrismaClient = prisma` last parameter
 * so tests can inject the pglite test client (test/setup.ts) instead of ever
 * touching the production-pointing singleton — same pattern as
 * ledger-cash-queries.ts.
 */

import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma";
import { ExpenseRepository } from "@/lib/accounting/expenseRepository";
import { AccountingRepository } from "@/lib/accounting/accountingRepository";
import { BalanceAssertionRepository } from "@/lib/accounting/balanceAssertionRepository";
import { CalkNotesRepository } from "@/lib/accounting/calkNotesRepository";
import { monthRange } from "@/lib/keuangan-month";
import { sumDaySales, type DaySalesInput } from "@/lib/day-close";
import { buildCalk, type CalkResult } from "@/lib/calk";
import {
  incomeStatement,
  balanceSheet,
  cashFlow,
  changesInEquity,
  runValidations,
  type IncomeStatementResult,
  type BalanceSheetResult,
  type CashFlowResult,
  type ChangesInEquityResult,
  type ValidationResult,
} from "@/lib/accounting";

// ---------------------------------------------------------------------------
// BigInt -> number (read-boundary conversion)
// ---------------------------------------------------------------------------

/** Recursively replace every `bigint` in T with `number` — the shape our
 *  BigInt->number deep converter (toPlain) actually produces at runtime. */
type Numberify<T> = T extends bigint
  ? number
  : T extends Array<infer U>
    ? Numberify<U>[]
    : T extends object
      ? { [K in keyof T]: Numberify<T[K]> }
      : T;

/**
 * Deep bigint->number converter for the statement-engine results, which are
 * built from bigint arithmetic throughout. BigInt cannot cross the
 * server/client serialization boundary — Rupiah amounts here are always well
 * below Number.MAX_SAFE_INTEGER, so converting is safe. Applied recursively
 * so it doesn't have to be sprinkled through every nested line/check.
 */
function toPlain<T>(value: T): Numberify<T> {
  if (typeof value === "bigint") return Number(value) as Numberify<T>;
  if (Array.isArray(value)) return value.map((v) => toPlain(v)) as Numberify<T>;
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = toPlain(v);
    }
    return out as Numberify<T>;
  }
  return value as Numberify<T>;
}

// ---------------------------------------------------------------------------
// getSaleTotals — independent cross-check source
// ---------------------------------------------------------------------------

/**
 * Local-calendar-day bounds [gte, lt) for [dateFrom, dateTo] (inclusive
 * "YYYY-MM-DD"). Deliberately LOCAL time, not UTC: kasir's day-close boundary
 * is `CashRegister.date` / `localDateKey` (lib/format.ts), both local-time —
 * see app/actions/admin/day-close-posting.ts. Using UTC bounds here (as the
 * tokokencana donor does) would misalign this cross-check against the actual
 * day-close postings it exists to validate.
 */
function localDayBounds(dateFrom: string, dateTo: string): { gte: Date; lt: Date } {
  const [fy, fm, fd] = dateFrom.split("-").map(Number);
  const [ty, tm, td] = dateTo.split("-").map(Number);
  return {
    gte: new Date(fy!, fm! - 1, fd!),
    lt: new Date(ty!, tm! - 1, td! + 1),
  };
}

/**
 * Period's sales totals from the SOURCE tables (Transaction + OnlineSettlement),
 * independent of what actually got posted to the ledger — the input to
 * runValidations' sales cross-check.
 *
 * WHY THIS MATTERS: kasir posts sales ONCE PER CLOSED DAY (tutup kas), not per
 * sale. A day whose register was never closed posts NOTHING to the ledger even
 * though Transaction rows exist for it — this cross-check is the only thing
 * that surfaces that gap.
 *
 * - tunai/qris: PAID Transaction rows in the period, reduced through
 *   `sumDaySales` (lib/day-close.ts) — the SAME function the real day-close
 *   posting uses, so this and the ledger agree by construction (same
 *   online-service exclusion, same SPLIT-leg handling).
 * - online: the GROSS of OnlineSettlement rows whose settlementDate falls in
 *   the period, because kasir recognizes online revenue at pencairan
 *   (settlement), never at order time (settlementPostingRepository).
 */
async function getSaleTotals(
  db: PrismaClient,
  dateFrom: string,
  dateTo: string,
): Promise<{ tunai: bigint; qris: bigint; online: bigint }> {
  const { gte, lt } = localDayBounds(dateFrom, dateTo);

  const transactions = await db.transaction.findMany({
    where: { status: "PAID", paidAt: { gte, lt } },
    select: {
      paymentMethod: true,
      cashAmount: true,
      qrisAmount: true,
      totalAmount: true,
      tableSession: { select: { service: true } },
    },
  });
  const inputs: DaySalesInput[] = transactions.map((t) => ({
    paymentMethod: t.paymentMethod,
    cashAmount: t.cashAmount,
    qrisAmount: t.qrisAmount,
    totalAmount: t.totalAmount,
    service: t.tableSession.service,
  }));
  const { cashSales, qrisSales } = sumDaySales(inputs);

  const settlements = await db.onlineSettlement.findMany({
    where: { settlementDate: { gte, lt } },
    select: { totalGross: true },
  });
  let online = 0n;
  for (const s of settlements) online += BigInt(s.totalGross);

  return { tunai: BigInt(cashSales), qris: BigInt(qrisSales), online };
}

// ---------------------------------------------------------------------------
// getLaporanKeuangan
// ---------------------------------------------------------------------------

export interface LaporanKeuangan {
  month: string;
  period: { dateFrom: string; dateTo: string };
  labaRugi: Numberify<IncomeStatementResult>;
  neraca: Numberify<BalanceSheetResult>;
  arusKas: Numberify<CashFlowResult>;
  perubahanModal: Numberify<ChangesInEquityResult>;
  validasi: Numberify<ValidationResult>;
  calk: CalkResult;
}

/** Resolve friendly kas labels for Neraca's asset lines (A1). Falls back to
 *  the account name's last segment when the registry has no label — mirrors
 *  getLedgerPengeluaranForPeriod (ledger-cash-queries.ts) and the schema
 *  comment on LedgerAccount.label. Does not touch balanceSheet()'s output
 *  shape or arithmetic — only the `label` string on each line. */
function withFriendlyAssetLabels(
  neraca: Numberify<BalanceSheetResult>,
  labelByName: Map<string, string | null>,
): Numberify<BalanceSheetResult> {
  const labelFor = (name: string) => labelByName.get(name) || name.split(":").pop() || name;
  return {
    ...neraca,
    aset: {
      ...neraca.aset,
      lines: neraca.aset.lines.map((l) => ({ ...l, label: labelFor(l.account) })),
    },
  };
}

/**
 * Build the full set of financial statements for one accounting month —
 * Laba Rugi, Neraca, Arus Kas, Perubahan Modal, the validation battery, and
 * the CALK notes payload. Returns ONE plain-JSON-safe object (bigint ->
 * number, proven recursively in test/laporan-keuangan.test.ts) so it can
 * cross the server/client boundary directly.
 *
 * Neraca/Perubahan Modal need cumulative history (opening balances, retained
 * earnings carried from prior periods), so the Book is loaded from the
 * beginning of time through `dateTo` — NOT scoped to [dateFrom, dateTo]. Each
 * statement function then restricts to the period itself via its own
 * dateFrom/dateTo args (Book.balance/balancePrefix take the range per call).
 *
 * `db` defaults to the app's Prisma singleton; tests inject the pglite test
 * client so this query-layer function is exercisable outside a live DB.
 */
export async function buildLaporanKeuangan(month: string, db: PrismaClient = prisma): Promise<LaporanKeuangan> {
  const { dateFrom, dateTo } = monthRange(month);

  const [book, categoryRows, saleTotals, assertions, accountRows, notes] = await Promise.all([
    new AccountingRepository(db).loadBook({ dateTo }),
    new ExpenseRepository(db).listCategories(),
    getSaleTotals(db, dateFrom, dateTo),
    new BalanceAssertionRepository(db).listForDate(dateTo),
    db.ledgerAccount.findMany({ where: { name: { startsWith: "Assets:" } }, select: { name: true, label: true } }),
    new CalkNotesRepository(db).listForMonth(month),
  ]);

  const cats: Record<string, { name: string }> = {};
  for (const c of categoryRows) cats[c.code] = { name: c.name };
  const labelByName = new Map(accountRows.map((a) => [a.name, a.label]));

  const labaRugi = incomeStatement(book, dateFrom, dateTo, cats);
  const neracaRaw = balanceSheet(book, dateTo);
  const arusKas = cashFlow(book, dateFrom, dateTo);
  const perubahanModal = changesInEquity(book, dateFrom, dateTo);
  // Only pass closingBalances when at least one account has been asserted —
  // an empty object would make the drift check trivially pass anyway, but
  // omitting it entirely keeps intent explicit (no invented zero expectations,
  // kasir has no Cek Saldo UI until Slice 5 so this list is normally empty).
  const closingBalances =
    assertions.length > 0
      ? Object.fromEntries(assertions.map((a) => [a.account, a.expected]))
      : undefined;
  const validasi = runValidations(book, dateFrom, dateTo, cats, { saleTotals, closingBalances });

  const neraca = withFriendlyAssetLabels(toPlain(neracaRaw), labelByName);

  const laporan = {
    month,
    period: { dateFrom, dateTo },
    labaRugi: toPlain(labaRugi),
    neraca,
    arusKas: toPlain(arusKas),
    perubahanModal: toPlain(perubahanModal),
    validasi: toPlain(validasi),
  };

  const calk = buildCalk(laporan, notes);

  return { ...laporan, calk };
}
