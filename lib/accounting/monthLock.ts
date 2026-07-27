/**
 * monthLock.ts — S25c/Slice 5 month-lock boundary (F-7 enforcement).
 *
 * AccountingMonth.lockedAt marks a month "tutup buku". The lock boundary is
 * the LAST DAY of the most-recently-locked month (by month string, not by
 * lockedAt timestamp — locking is a per-month toggle, not a queue). Entries
 * dated on or before that boundary are rejected by
 * AccountingRepository.assertNotLocked (already implemented — this module
 * only supplies the boundary).
 *
 * Deliberately does NOT import any of the posting repositories (catatRepository,
 * expenseRepository, salesPostingRepository, purchasePostingRepository) — they
 * import THIS module to build their default options, so an import back the
 * other way would be a cycle.
 */

import { PrismaClient } from "@/generated/prisma";
import type { AccountingRepoOptions } from "./accountingRepository";

/** Last calendar day of "YYYY-MM" as "YYYY-MM-DD" (handles Feb + leap years). */
function lastDayOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  // Day 0 of the next month == last day of this month (UTC, no DST issues).
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

/**
 * The lock boundary (inclusive) — the last day of the greatest locked month,
 * or null when no month is locked.
 */
export async function monthLockBoundary(prisma: PrismaClient): Promise<string | null> {
  const row = await prisma.accountingMonth.findFirst({
    where: { lockedAt: { not: null } },
    orderBy: { month: "desc" },
    select: { month: true },
  });
  if (!row) return null;
  return lastDayOfMonth(row.month);
}

/**
 * Ready-to-spread AccountingRepoOptions wired to the live lock boundary.
 *
 * The boundary query is fired EAGERLY, right here, rather than lazily inside
 * the returned provider. Reason: assertNotLocked calls the provider from
 * INSIDE an already-open `postEntryTx`/`voidEntry` transaction. Issuing a
 * fresh query on the plain (non-tx) `prisma` client at that point is fine
 * against real pooled Postgres, but pglite (the test harness) is a single
 * in-process connection — a query from the outer client while a transaction
 * is open on `tx` has nowhere to go and hangs until the transaction's own
 * timeout kills it. Kicking the query off here, at repository-construction
 * time (always before any transaction this instance later opens), means the
 * provider just awaits an already-in-flight/resolved promise — no query is
 * ever issued while a transaction is open.
 */
export function monthLockOptions(prisma: PrismaClient): AccountingRepoOptions {
  const boundary = monthLockBoundary(prisma);
  // A repository can be constructed without ever posting (e.g. only listing),
  // leaving this promise unawaited — swallow it HERE only to keep Node from
  // reporting an unhandled rejection. Awaiting it later still rejects.
  boundary.catch(() => {});
  return { lockedUntilProvider: () => boundary };
}
