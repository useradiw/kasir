/**
 * journal-sequence.test.ts — gapless-unique journal numbering survives a restore.
 *
 * Found in UAT 2026-09-03: a backup carries the `sequences` table, so restoring
 * an older file rewound the "journal" counter and the next posted entry reused a
 * number the ledger already had. Two live entries ended up numbered 9 and
 * nothing complained, because `JournalEntry.number` carried no unique index —
 * the invariant lived only in a comment and in sequenceHelper's correctness.
 *
 * Two guards here, matching the two halves of the fix:
 *   1. the database refuses a duplicate number outright;
 *   2. reconcileJournalSequence moves a rewound counter forward, and never back.
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { PrismaClient } from "@/generated/prisma";
import {
  reconcileJournalSequence,
  JOURNAL_SEQUENCE_KEY,
} from "../lib/accounting/reconcileJournalSequence";
import { createTestClient, resetDb } from "./setup";

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestClient();
});

afterEach(async () => {
  await resetDb(prisma);
});

async function postedEntry(number: number, narration = `Entri ${number}`) {
  return prisma.journalEntry.create({
    data: { number, state: "POSTED", date: "2026-09-03", narration, postedAt: new Date() },
  });
}

describe("JournalEntry.number is unique in the database", () => {
  it("refuses a second entry with the same number", async () => {
    await postedEntry(9);
    await expect(postedEntry(9, "Tabrakan nomor")).rejects.toThrow();
    expect(await prisma.journalEntry.count({ where: { number: 9 } })).toBe(1);
  });

  it("has the unique index on the number column", async () => {
    const rows = await prisma.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'journal_entries'`,
    );
    expect(rows.some((r) => /UNIQUE/i.test(r.indexdef) && /\(number\)/.test(r.indexdef))).toBe(true);
  });

  it("still allows many DRAFT entries with no number", async () => {
    await prisma.journalEntry.create({
      data: { state: "DRAFT", date: "2026-09-03", narration: "Draf satu" },
    });
    await prisma.journalEntry.create({
      data: { state: "DRAFT", date: "2026-09-03", narration: "Draf dua" },
    });
    expect(await prisma.journalEntry.count({ where: { number: null } })).toBe(2);
  });
});

describe("reconcileJournalSequence", () => {
  it("moves a rewound counter forward to the highest number in the ledger", async () => {
    await postedEntry(1);
    await postedEntry(8);
    await postedEntry(12);
    // What a restore does: the backup's counter was 8 when it was exported.
    await prisma.sequence.create({ data: { key: JOURNAL_SEQUENCE_KEY, value: 8 } });

    const result = await reconcileJournalSequence(prisma);

    expect(result.before).toBe(8);
    expect(result.maxNumber).toBe(12);
    expect(result.after).toBe(12);
    expect(result.repaired).toBe(true);
  });

  it("never lowers a counter that is already ahead", async () => {
    await postedEntry(3);
    await prisma.sequence.create({ data: { key: JOURNAL_SEQUENCE_KEY, value: 50 } });

    const result = await reconcileJournalSequence(prisma);

    expect(result.repaired).toBe(false);
    expect(result.after).toBe(50);
    const row = await prisma.sequence.findUnique({ where: { key: JOURNAL_SEQUENCE_KEY } });
    expect(row?.value).toBe(50);
  });

  it("creates the row when a restore dropped it, and an empty ledger yields 0", async () => {
    const result = await reconcileJournalSequence(prisma);

    expect(result.before).toBeNull();
    expect(result.maxNumber).toBe(0);
    const row = await prisma.sequence.findUnique({ where: { key: JOURNAL_SEQUENCE_KEY } });
    expect(row?.value).toBe(0);
  });

  it("leaves the next posted number free of collisions", async () => {
    await postedEntry(1);
    await postedEntry(9);
    await prisma.sequence.create({ data: { key: JOURNAL_SEQUENCE_KEY, value: 8 } });

    const { after } = await reconcileJournalSequence(prisma);
    // The next number the helper would hand out is after + 1.
    await expect(postedEntry(after + 1, "Entri berikutnya")).resolves.toBeTruthy();
  });
});
