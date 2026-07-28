"use server";

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

/**
 * Signed net movement on `account`, per "YYYY-MM-DD" date in `dates`, from
 * everything EXCEPT the shift-close (day-close) entries.
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
export async function getNonSalesCashMovementByDate(
  account: string,
  dates: string[],
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  if (dates.length === 0) return result;

  const lines = await prisma.journalLine.findMany({
    where: {
      account,
      entry: {
        date: { in: dates },
        state: { in: ["POSTED", "VOID"] },
        OR: [{ sourceType: null }, { sourceType: { not: "shift-close" } }],
      },
    },
    select: { amount: true, entry: { select: { date: true } } },
  });

  for (const line of lines) {
    const key = line.entry.date;
    result[key] = (result[key] ?? 0) + Number(line.amount);
  }

  return result;
}
