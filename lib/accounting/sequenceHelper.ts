/**
 * sequenceHelper.ts — Shared gapless sequence helper for use inside Prisma transactions.
 *
 * nextSequenceTx(tx, key): atomically increment the sequence for the given key
 * and return the new value.
 *
 * Design:
 * - Get or create the sequence row, tolerating concurrent-create races via P2002 catch.
 * - Atomically increment via raw SQL (UPDATE … RETURNING) inside the caller's tx.
 * - Returns the new gapless Int value.
 *
 * The caller MUST pass an active Prisma interactive-transaction client (tx).
 * This helper never opens its own $transaction.
 */

import { Prisma } from "@/generated/prisma";

export async function nextSequenceTx(tx: Prisma.TransactionClient, key: string): Promise<number> {
  // Ensure the sequence row exists WITHOUT a create/insert race:
  // findUnique first to avoid unnecessary CREATE attempts when row already exists.
  const existing = await tx.sequence.findUnique({ where: { key } });
  if (!existing) {
    try {
      await tx.sequence.create({ data: { key, value: 0 } });
    } catch (e) {
      // A concurrent transaction created the row first — that's fine, the row
      // now exists and the atomic UPDATE…RETURNING below is still gapless.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) {
        throw e;
      }
    }
  }

  const rows = await tx.$queryRaw<[{ value: number }]>`
    UPDATE sequences
    SET value = value + 1
    WHERE key = ${key}
    RETURNING value
  `;

  const row = rows[0];
  if (!row) throw new Error(`Sequence increment for key="${key}" returned no row`);
  return row.value;
}
