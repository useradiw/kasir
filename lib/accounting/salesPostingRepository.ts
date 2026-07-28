/**
 * salesPostingRepository.ts — one journal entry per closed kasir day (Slice 3a).
 *
 * Cash-basis: only tunai + elektronik (QRIS) settle same-day, into the
 * physical/virtual kas drawer. Online sales are NOT posted here — they post
 * at settlement time (settlementPostingRepository), because the cash only
 * actually lands when the platform pays out, days later.
 *
 * Design constraint (test/setup.ts only applies the Warung Books migration —
 * kasir's operational tables do not exist in the pglite test DB): this
 * repository accepts an already-computed DayCloseSpec. It never queries
 * Transaction/CashRegister/Expense — all aggregation happens in the action
 * layer that calls this repo.
 *
 * Money = BigInt Rupiah. Positive = debit, negative = credit. Every posted
 * entry's lines sum to 0n (enforced by @padu/core via postEntryTx).
 */

import { PrismaClient, Prisma } from "@/generated/prisma";
import {
  AccountingRepository,
  type AccountingRepoOptions,
} from "./accountingRepository";
import { monthLockOptions } from "./monthLock";
import { SELISIH_ACCOUNTS } from "./accounts";
import { DomainError } from "../errors";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class DayCloseAlreadyPostedError extends DomainError {
  constructor(date: string) {
    super(`Tutup kas tanggal ${date} sudah dicatat ke buku besar.`);
    this.name = "DayCloseAlreadyPostedError";
  }
}

/**
 * Not a user mistake — the caller (action layer) asked to void/repost a
 * cashRegisterId that has no ledger posting. Mirrors EntryNotFoundError in
 * accountingRepository.ts (plain Error, never shown to a user).
 */
export class DayClosePostingNotFoundError extends Error {
  constructor(cashRegisterId: string) {
    super(`No day-close posting found for cashRegisterId="${cashRegisterId}"`);
    this.name = "DayClosePostingNotFoundError";
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DayCloseSpec {
  date: string; // "YYYY-MM-DD" — the register's business date
  cashRegisterId: string; // LedgerPosting.sourceId
  cashSales: bigint; // tunai received into the drawer that day
  qrisSales: bigint; // electronic (QRIS) received that day
  expectedCash: bigint; // openingCash + cashSales - cash paid out
  countedCash: bigint; // the physical count entered at close
  tunaiAccount: string; // Assets:Cash:<laci>
  elektronikAccount: string; // Assets:Cash:<bank/qris>
}

export interface PostedDayClose {
  journalEntryId: string;
  lines: { account: string; amount: bigint }[];
}

export interface DayClosePostingRow {
  journalEntryId: string;
}

interface DayCloseSourceMeta {
  cashSales: string;
  qrisSales: string;
  expectedCash: string;
  countedCash: string;
  selisih: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the day-close lines per the spec's algorithm. Empty when nothing to record. */
function buildLines(spec: DayCloseSpec): { account: string; amount: bigint }[] {
  const lines: { account: string; amount: bigint }[] = [];

  if (spec.cashSales > 0n) {
    lines.push({ account: spec.tunaiAccount, amount: spec.cashSales });
    lines.push({ account: "Income:Sales:Tunai", amount: -spec.cashSales });
  }

  if (spec.qrisSales > 0n) {
    lines.push({ account: spec.elektronikAccount, amount: spec.qrisSales });
    lines.push({ account: "Income:Sales:QRIS", amount: -spec.qrisSales });
  }

  const selisih = spec.countedCash - spec.expectedCash;
  if (selisih < 0n) {
    // kurang (short): expense the shortfall, reduce the recorded cash leg.
    lines.push({ account: SELISIH_ACCOUNTS.expense, amount: -selisih });
    lines.push({ account: spec.tunaiAccount, amount: selisih });
  } else if (selisih > 0n) {
    // lebih (over): increase the recorded cash leg, credit the surplus as income.
    lines.push({ account: spec.tunaiAccount, amount: selisih });
    lines.push({ account: SELISIH_ACCOUNTS.income, amount: -selisih });
  }

  return lines;
}

function buildSourceMeta(spec: DayCloseSpec): DayCloseSourceMeta {
  return {
    cashSales: spec.cashSales.toString(),
    qrisSales: spec.qrisSales.toString(),
    expectedCash: spec.expectedCash.toString(),
    countedCash: spec.countedCash.toString(),
    selisih: (spec.countedCash - spec.expectedCash).toString(),
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class SalesPostingRepository {
  private readonly accounting: AccountingRepository;

  constructor(
    private readonly prisma: PrismaClient,
    accountingOptions: AccountingRepoOptions = {},
  ) {
    this.accounting = new AccountingRepository(prisma, {
      ...accountingOptions,
      lockedUntilProvider:
        accountingOptions.lockedUntilProvider ?? monthLockOptions(prisma).lockedUntilProvider,
    });
  }

  /**
   * Post the day-close entry. Returns null and writes NOTHING when
   * cashSales, qrisSales, and selisih are all zero — a day with no sales and
   * an exact count is not a ledger event.
   */
  async postDayClose(spec: DayCloseSpec): Promise<PostedDayClose | null> {
    const lines = buildLines(spec);
    if (lines.length === 0) return null;

    const existing = await this.getPostingFor(spec.cashRegisterId);
    if (existing) throw new DayCloseAlreadyPostedError(spec.date);

    const sourceMeta = buildSourceMeta(spec);
    const narration = `Tutup kas ${spec.date}`;

    await this.accounting.warmLock();
    try {
      const posted = await this.prisma.$transaction(async (tx) => {
        const entry = await this.accounting.postEntryTx(tx, {
          date: spec.date,
          narration,
          lines,
        });
        await tx.journalEntry.update({
          where: { id: entry.id },
          data: {
            sourceType: "shift-close",
            sourceMeta: sourceMeta as unknown as Prisma.InputJsonValue,
          },
        });
        await tx.ledgerPosting.create({
          data: {
            sourceType: "shift-close",
            sourceId: spec.cashRegisterId,
            journalEntryId: entry.id,
          },
        });
        return entry;
      });

      return { journalEntryId: posted.id, lines: posted.lines };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        // Concurrent double-close race — unique constraint is the backstop.
        throw new DayCloseAlreadyPostedError(spec.date);
      }
      throw e;
    }
  }

  /**
   * Void the existing day-close entry (if any) and post the corrected one, in
   * ONE $transaction, then UPDATE the existing LedgerPosting row to point at
   * the new journalEntryId (never a second row — the unique constraint
   * forbids it). If no posting exists yet, behaves like postDayClose.
   *
   * If the corrected spec has nothing to record (all-zero), the old entry is
   * voided and the correlation row removed — same end-state as voidDayClose.
   */
  async repostDayClose(spec: DayCloseSpec): Promise<PostedDayClose | null> {
    const existing = await this.getPostingFor(spec.cashRegisterId);
    if (!existing) return this.postDayClose(spec);

    const lines = buildLines(spec);
    const sourceMeta = buildSourceMeta(spec);
    const narration = `Tutup kas ${spec.date}`;

    await this.accounting.warmLock();
    const result = await this.prisma.$transaction(async (tx) => {
      await this.accounting.voidEntryTx(tx, existing.journalEntryId);

      if (lines.length === 0) {
        await tx.ledgerPosting.delete({
          where: { sourceType_sourceId: { sourceType: "shift-close", sourceId: spec.cashRegisterId } },
        });
        return null;
      }

      const entry = await this.accounting.postEntryTx(tx, {
        date: spec.date,
        narration,
        lines,
      });
      await tx.journalEntry.update({
        where: { id: entry.id },
        data: {
          sourceType: "shift-close",
          sourceMeta: sourceMeta as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.ledgerPosting.update({
        where: { sourceType_sourceId: { sourceType: "shift-close", sourceId: spec.cashRegisterId } },
        data: { journalEntryId: entry.id },
      });
      return { journalEntryId: entry.id, lines: entry.lines };
    });

    return result;
  }

  /** Void the day-close entry and remove the correlation row. */
  async voidDayClose(cashRegisterId: string): Promise<void> {
    const existing = await this.getPostingFor(cashRegisterId);
    if (!existing) throw new DayClosePostingNotFoundError(cashRegisterId);

    await this.accounting.warmLock();
    await this.prisma.$transaction(async (tx) => {
      await this.accounting.voidEntryTx(tx, existing.journalEntryId);
      await tx.ledgerPosting.delete({
        where: { sourceType_sourceId: { sourceType: "shift-close", sourceId: cashRegisterId } },
      });
    });
  }

  /** The correlation row for a cashRegisterId, or null. */
  async getPostingFor(cashRegisterId: string): Promise<DayClosePostingRow | null> {
    const row = await this.prisma.ledgerPosting.findUnique({
      where: { sourceType_sourceId: { sourceType: "shift-close", sourceId: cashRegisterId } },
      select: { journalEntryId: true },
    });
    return row ? { journalEntryId: row.journalEntryId } : null;
  }
}
