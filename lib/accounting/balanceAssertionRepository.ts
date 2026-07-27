/**
 * balanceAssertionRepository.ts — Cek Saldo (counted cash vs ledger), Slice 5.
 *
 * A BalanceAssertion records "the physically-counted balance of kas account X
 * was Y on date Z". There is no unique DB constraint on (account, date) — this
 * repo enforces upsert-per-(account,date) semantics itself: re-recording the
 * same account+date REPLACES the previous row rather than stacking duplicates,
 * via a findFirst-then-update-or-create inside a $transaction.
 *
 * Feeds getLaporanKeuangan's validation battery (check 10, "Saldo kas sesuai
 * assertion") via ValidationConn.closingBalances — the drift math itself lives
 * in validate.ts, not here.
 */

import { PrismaClient } from "@/generated/prisma";
import { DomainError } from "../errors";

const CASH_PREFIX = "Assets:Cash:";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class InvalidBalanceAssertionError extends DomainError {
  constructor(reason: string) {
    super(reason);
    this.name = "InvalidBalanceAssertionError";
  }
}

export interface RecordBalanceAssertionInput {
  account: string;
  date: string;
  expected: bigint;
  note?: string;
  createdBy: string;
}

export interface BalanceAssertionRow {
  id: string;
  account: string;
  date: string;
  expected: bigint;
  note: string | null;
  createdBy: string;
}

function mapRow(row: {
  id: string;
  account: string;
  date: string;
  expected: bigint;
  note: string | null;
  createdBy: string;
}): BalanceAssertionRow {
  return {
    id: row.id,
    account: row.account,
    date: row.date,
    expected: row.expected,
    note: row.note,
    createdBy: row.createdBy,
  };
}

export class BalanceAssertionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Record (or replace) the counted balance for an account+date. Upsert
   * semantics: a second call for the same (account, date) REPLACES the first
   * rather than stacking a duplicate row.
   */
  async record(input: RecordBalanceAssertionInput): Promise<BalanceAssertionRow> {
    if (!input.account.startsWith(CASH_PREFIX)) {
      throw new InvalidBalanceAssertionError("Akun kas tidak valid — harus akun kas (Assets:Cash:...).");
    }
    if (!DATE_RE.test(input.date)) {
      throw new InvalidBalanceAssertionError("Tanggal tidak valid — gunakan format YYYY-MM-DD.");
    }
    if (input.expected < 0n) {
      throw new InvalidBalanceAssertionError("Saldo tidak boleh negatif.");
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.balanceAssertion.findFirst({
        where: { account: input.account, date: input.date },
      });
      if (existing) {
        return tx.balanceAssertion.update({
          where: { id: existing.id },
          data: {
            expected: input.expected,
            note: input.note?.trim() || null,
            createdBy: input.createdBy,
          },
        });
      }
      return tx.balanceAssertion.create({
        data: {
          account: input.account,
          date: input.date,
          expected: input.expected,
          note: input.note?.trim() || null,
          createdBy: input.createdBy,
        },
      });
    });

    return mapRow(row);
  }

  /**
   * The latest assertion per account, at or before `date`. "Latest" = the
   * assertion with the greatest `date` (ties broken by updatedAt) among rows
   * with date <= the given date.
   */
  async listForDate(date: string): Promise<BalanceAssertionRow[]> {
    if (!DATE_RE.test(date)) {
      throw new InvalidBalanceAssertionError("Tanggal tidak valid — gunakan format YYYY-MM-DD.");
    }
    const rows = await this.prisma.balanceAssertion.findMany({
      where: { date: { lte: date } },
      orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
    });

    const latestByAccount = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!latestByAccount.has(row.account)) latestByAccount.set(row.account, row);
    }
    return [...latestByAccount.values()].map(mapRow);
  }
}
