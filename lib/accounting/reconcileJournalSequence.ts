/**
 * reconcileJournalSequence.ts — repair the "journal" sequence after a restore.
 *
 * A backup carries the `sequences` table, so restoring an older file rewinds
 * the journal counter to its value at export time. Every entry posted after
 * that reuses a number the ledger already has, and gapless-unique numbering is
 * the one property the journal cannot be wrong about. In UAT on 2026-09-03 this
 * produced two live entries both numbered 9, silently, because nothing looked.
 *
 * The rule is one-directional on purpose: the counter may only move FORWARD.
 * Lowering it would reintroduce the collision this exists to prevent, so a
 * stored value already at or above max(number) is left untouched.
 *
 * Pure logic with an injectable client, per the project's lib/ pattern — the
 * restore action calls it as a post-pass, and the test drives it on pglite.
 */

import type { PrismaClient } from "@/generated/prisma";

export const JOURNAL_SEQUENCE_KEY = "journal";

export type JournalSequenceReconciliation = {
  /** Highest journal number currently in the ledger (0 when there are none). */
  maxNumber: number;
  /** Sequence value before the repair, or null when the row did not exist. */
  before: number | null;
  /** Sequence value after the repair. */
  after: number;
  /** True when the stored value was behind and had to be moved forward. */
  repaired: boolean;
};

export async function reconcileJournalSequence(
  db: PrismaClient,
): Promise<JournalSequenceReconciliation> {
  const highest = await db.journalEntry.aggregate({ _max: { number: true } });
  const maxNumber = highest._max.number ?? 0;

  const existing = await db.sequence.findUnique({
    where: { key: JOURNAL_SEQUENCE_KEY },
  });
  const before = existing?.value ?? null;

  if (existing && existing.value >= maxNumber) {
    return { maxNumber, before, after: existing.value, repaired: false };
  }

  await db.sequence.upsert({
    where: { key: JOURNAL_SEQUENCE_KEY },
    create: { key: JOURNAL_SEQUENCE_KEY, value: maxNumber },
    update: { value: maxNumber },
  });

  return { maxNumber, before, after: maxNumber, repaired: true };
}
