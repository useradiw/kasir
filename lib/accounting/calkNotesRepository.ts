/**
 * calkNotesRepository.ts — CALK (Catatan Atas Laporan Keuangan) free-text notes.
 *
 * CALK sections are mostly GENERATED (see lib/calk.ts — derived only from the
 * laporan the caller already built), plus one owner-editable free-text note per
 * section. Notes are per-month, keyed into the EXISTING `AccountingSetting`
 * key/value table under `calk:<month>:<sectionKey>` — no migration needed.
 *
 * An empty/blank note DELETES the row rather than storing an empty string, so
 * the settings table doesn't accumulate noise for sections the owner never
 * annotated. listForMonth simply omits keys that were never written (or were
 * cleared back to empty) — callers treat a missing entry the same as "".
 */

import { PrismaClient } from "@/generated/prisma";

const KEY_PREFIX = "calk:";

function keyFor(month: string, sectionKey: string): string {
  return `${KEY_PREFIX}${month}:${sectionKey}`;
}

export class CalkNotesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** sectionKey -> note text, for every section that has a non-empty note this month. */
  async listForMonth(month: string): Promise<Record<string, string>> {
    const prefix = `${KEY_PREFIX}${month}:`;
    const rows = await this.prisma.accountingSetting.findMany({
      where: { key: { startsWith: prefix } },
    });
    const notes: Record<string, string> = {};
    for (const row of rows) {
      notes[row.key.slice(prefix.length)] = row.value;
    }
    return notes;
  }

  /**
   * Save (or clear) one section's note for a month. A blank/whitespace-only
   * note deletes the row instead of writing an empty string.
   */
  async upsert(month: string, sectionKey: string, note: string): Promise<void> {
    const key = keyFor(month, sectionKey);
    const trimmed = note.trim();
    if (!trimmed) {
      await this.prisma.accountingSetting.deleteMany({ where: { key } });
      return;
    }
    await this.prisma.accountingSetting.upsert({
      where: { key },
      update: { value: trimmed },
      create: { key, value: trimmed },
    });
  }
}
