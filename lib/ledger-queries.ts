/**
 * ledger-cash-queries.ts — expected-cash support (Slice 3a wiring).
 *
 * getNonSalesCashMovementByDate reads the buku besar (not the operational
 * Expense table) for everything that moves a kas account OTHER than the
 * day-close (shift-close) posting itself — pengeluaran, transfer, modal,
 * prive, saldo-awal, manual adjustments. Combined with sumDaySales'
 * cashSales, this reproduces tutup kas' expected-cash number from the ledger,
 * so tutup kas and the buku besar agree by construction.
 */

import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma";
import { ExpenseRepository } from "@/lib/accounting/expenseRepository";

/** One journal-line-level cash movement, as returned by
 *  getNonSalesCashMovementLines — the line-level counterpart of
 *  getNonSalesCashMovementByDate's per-date net. */
export type CashMovementLine = {
  dateKey: string;
  narration: string;
  amount: number;
  sourceType: string | null;
  entryNumber: number | null;
  entryId: string;
  /** entry.postedAt (ISO string), null for an entry that never reached POSTED
   *  (a VOID row that was voided pre-POST, in principle) — the Kas screen's
   *  movements list uses this for the "<time> · <sourceType>" meta line. */
  postedAt: string | null;
};

/**
 * Line-level version of getNonSalesCashMovementByDate: the individual
 * journal lines behind the net, per "YYYY-MM-DD" date in `dates`, from
 * everything EXCEPT the shift-close (day-close) entries.
 *
 * Uses the EXACT same where-filter as getNonSalesCashMovementByDate —
 * including the NULL-safety and POSTED/VOID netting invariant documented
 * below — because getNonSalesCashMovementByDate is now a reduction over this
 * function's output. The filter lives here, in exactly one place.
 *
 * - Includes both POSTED and VOID lines: a voided entry and its reversal net
 *   to zero (see AccountingRepository.loadBook's documented invariant) —
 *   excluding VOID would leave the reversal stranded and give wrong totals.
 * - Excludes sourceType="shift-close" to avoid the chicken-and-egg of a day
 *   close reading its own posting.
 * - `sourceType` is nullable on JournalEntry (manual "Penyesuaian" entries,
 *   plain postEntry calls). A naive `sourceType: { not: "shift-close" }`
 *   filter would silently exclude those NULL rows too — SQL's `<>` yields
 *   NULL (not TRUE) when compared against NULL, so Prisma's `not` filter
 *   drops them. The explicit OR below implements true
 *   `IS DISTINCT FROM 'shift-close'` semantics: NULL sourceType always
 *   qualifies, and non-null sourceType qualifies unless it IS "shift-close".
 */
export async function getNonSalesCashMovementLines(
  account: string,
  dates: string[],
  db: PrismaClient = prisma,
): Promise<Record<string, CashMovementLine[]>> {
  const result: Record<string, CashMovementLine[]> = {};
  if (dates.length === 0) return result;

  const lines = await db.journalLine.findMany({
    where: {
      account,
      entry: {
        date: { in: dates },
        state: { in: ["POSTED", "VOID"] },
        OR: [{ sourceType: null }, { sourceType: { not: "shift-close" } }],
      },
    },
    select: {
      amount: true,
      entry: {
        select: { id: true, date: true, narration: true, sourceType: true, number: true, postedAt: true },
      },
    },
  });

  for (const line of lines) {
    const key = line.entry.date;
    const bucket = result[key] ?? (result[key] = []);
    bucket.push({
      dateKey: key,
      narration: line.entry.narration,
      amount: Number(line.amount),
      sourceType: line.entry.sourceType,
      entryNumber: line.entry.number,
      entryId: line.entry.id,
      postedAt: line.entry.postedAt ? line.entry.postedAt.toISOString() : null,
    });
  }

  return result;
}

/**
 * Signed net movement on `account`, per "YYYY-MM-DD" date in `dates`, from
 * everything EXCEPT the shift-close (day-close) entries. A reduction over
 * getNonSalesCashMovementLines — see that function for the filter this
 * shares with the line-level view (kept in exactly one place on purpose, so
 * the movements list and this net can never drift from each other).
 */
export async function getNonSalesCashMovementByDate(
  account: string,
  dates: string[],
  db: PrismaClient = prisma,
): Promise<Record<string, number>> {
  const linesByDate = await getNonSalesCashMovementLines(account, dates, db);
  const result: Record<string, number> = {};
  for (const [key, lines] of Object.entries(linesByDate)) {
    result[key] = lines.reduce((sum, l) => sum + l.amount, 0);
  }
  return result;
}

/**
 * Ledger-based HPP/OpEx totals for laporan (Slice 3b) — replaces the old
 * per-sale `Transaction.cogs` figure (dead since Slice 1) and the private
 * `Expense`-table sum. HPP is not a per-sale cost under Warung Books; it is
 * the `Expenses:HPP:*` bucket, fed by pengeluaran (bahan baku purchases).
 *
 * - Sums every `Expenses:*` line in [dateFrom, dateTo] (both inclusive).
 * - Includes both POSTED and VOID: a voided pengeluaran plus its reversal
 *   nets to zero (same invariant as getNonSalesCashMovementByDate above) —
 *   excluding VOID would strand the reversal leg and produce garbage.
 * - hpp = accounts under "Expenses:HPP:*"; opex = every other Expenses:*
 *   account (OpEx, SelisihKas, KomisiOnline, ...) — real costs, all counted
 *   once, so hpp + opex always equals the grand total of Expenses:* lines.
 *
 * `db` defaults to the production-pointing singleton (`@/lib/prisma`) for
 * real call sites (report-queries.ts) — tests inject the pglite test client
 * instead so the suite never touches DATABASE_URL (production).
 */
export async function getLedgerExpenseTotals(
  dateFrom: string,
  dateTo: string,
  db: PrismaClient = prisma,
): Promise<{
  hpp: number;
  opex: number;
  byAccount: Record<string, number>;
  byDate: Record<string, number>;
}> {
  const lines = await db.journalLine.findMany({
    where: {
      account: { startsWith: "Expenses:" },
      entry: {
        date: { gte: dateFrom, lte: dateTo },
        state: { in: ["POSTED", "VOID"] },
      },
    },
    select: { account: true, amount: true, entry: { select: { date: true } } },
  });

  let hpp = 0;
  let opex = 0;
  const byAccount: Record<string, number> = {};
  const byDate: Record<string, number> = {};

  for (const line of lines) {
    const amount = Number(line.amount);
    byAccount[line.account] = (byAccount[line.account] ?? 0) + amount;
    byDate[line.entry.date] = (byDate[line.entry.date] ?? 0) + amount;
    if (line.account.startsWith("Expenses:HPP:")) {
      hpp += amount;
    } else {
      opex += amount;
    }
  }

  return { hpp, opex, byAccount, byDate };
}

/**
 * getCashAccountBalances — the ONE new query approved for the /buku
 * pengeluaran rebuild (docs/redesign/plan-open-items.md section 1, build
 * order 5, task C). Current balance of every `Assets:Cash:*` ledger account,
 * optionally bounded by `dateTo`.
 *
 * - Includes both POSTED and VOID entries, same invariant documented on
 *   getNonSalesCashMovementByDate above: a voided entry and its reversal net
 *   to zero, so excluding VOID would strand the reversal leg and produce a
 *   wrong balance.
 * - Not wired into any page yet, and there is no server-action wrapper for
 *   it — it exists with its test only. Wiring the "Kas Laci setelah
 *   transfer" figure from screens-buku-forms.html mockup 2 is a later step.
 *
 * `db` defaults to the production-pointing singleton, same rationale as the
 * other functions in this file — tests inject the pglite test client so the
 * suite never touches DATABASE_URL (production).
 */
export async function getCashAccountBalances(
  opts: { dateTo?: string } = {},
  db: PrismaClient = prisma,
): Promise<Record<string, number>> {
  const lines = await db.journalLine.findMany({
    where: {
      account: { startsWith: "Assets:Cash:" },
      entry: {
        state: { in: ["POSTED", "VOID"] },
        ...(opts.dateTo ? { date: { lte: opts.dateTo } } : {}),
      },
    },
    select: { account: true, amount: true },
  });

  const balances: Record<string, number> = {};
  for (const line of lines) {
    balances[line.account] = (balances[line.account] ?? 0) + Number(line.amount);
  }
  return balances;
}

/**
 * Ledger pengeluaran list for laporan's expense table (Slice 3b). Thin
 * wrapper over ExpenseRepository.listPengeluaran — reuses its sourceMeta
 * parsing/shape rather than re-implementing it, with VOID entries included
 * (and their state exposed) so the UI can mark them instead of silently
 * dropping them.
 *
 * `db` defaults to the production-pointing singleton, same rationale as
 * getLedgerExpenseTotals above — tests inject the pglite test client.
 */
export async function getLedgerPengeluaranForPeriod(
  dateFrom: string,
  dateTo: string,
  db: PrismaClient = prisma,
): Promise<
  {
    id: string; date: string; item: string; jumlah: number;
    kategoriCode: string; kategoriNama: string;
    akun: string; akunLabel: string; state: string;
  }[]
> {
  const rows = await new ExpenseRepository(db).listPengeluaran({
    dateFrom,
    dateTo,
    includeVoid: true,
  });

  // Resolve friendly kas-account labels. Laporan is read by the owner, not by an
  // accountant — showing the raw Beancount name ("Assets:Cash:PakHar") is not
  // useful. LedgerAccount.label exists for exactly this; fall back to the name's
  // last segment when it is null, matching the schema comment.
  const accounts = await db.ledgerAccount.findMany({ select: { name: true, label: true } });
  const labelByName = new Map(accounts.map((a) => [a.name, a.label]));
  const labelFor = (name: string) =>
    labelByName.get(name) || name.split(":").pop() || name;

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    item: r.item,
    jumlah: Number(r.jumlah),
    kategoriCode: r.kategoriCode,
    // A deleted/renamed kategori can leave this null — fall back to the code so
    // laporan never renders an empty cell.
    kategoriNama: r.kategoriNama ?? r.kategoriCode,
    akun: r.akun,
    akunLabel: labelFor(r.akun),
    state: r.state,
  }));
}
