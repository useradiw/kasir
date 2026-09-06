/**
 * settlementPostingRepository.ts — post one journal entry per online-platform
 * payout (GoFood/ShopeeFood/GrabFood), Slice 3a.
 *
 * Online sales are recognized here, at settlement, not at order time — the
 * cash only actually lands when the platform pays out (see
 * salesPostingRepository's day-close, which deliberately excludes "online").
 *
 * Design constraint (test/setup.ts only applies the Warung Books migration):
 * this repository accepts an already-computed SettlementSpec. It never
 * queries the settlement/deduction operational tables — all aggregation
 * happens in the action layer that calls this repo.
 *
 * Money = BigInt Rupiah. Positive = debit, negative = credit.
 */

import { PrismaClient, Prisma } from "@/generated/prisma";
import {
  AccountingRepository,
  type AccountingRepoOptions,
} from "./accountingRepository";
import { monthLockOptions } from "./monthLock";
import { DomainError } from "../errors";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class SettlementImbalanceError extends DomainError {
  constructor(totalGross: bigint, finalAmount: bigint, commissionAmount: bigint, deductionsTotal: bigint) {
    const receivedSide = finalAmount + commissionAmount + deductionsTotal;
    const diff = totalGross - receivedSide;
    super(
      `Pencairan tidak seimbang: total penjualan ${rupiah(totalGross)} tidak sama dengan diterima + komisi + potongan (${rupiah(receivedSide)}). Selisih ${rupiah(diff < 0n ? -diff : diff)}. Periksa kembali angka pencairan.`,
    );
    this.name = "SettlementImbalanceError";
  }
}

export class InvalidSettlementError extends DomainError {
  constructor(reason: string) {
    super(reason);
    this.name = "InvalidSettlementError";
  }
}

export class SettlementAlreadyPostedError extends DomainError {
  constructor(date: string) {
    super(`Pencairan tanggal ${date} sudah dicatat ke buku besar.`);
    this.name = "SettlementAlreadyPostedError";
  }
}

/** Not a user mistake — mirrors DayClosePostingNotFoundError. */
export class SettlementPostingNotFoundError extends Error {
  constructor(settlementId: string) {
    super(`No settlement posting found for settlementId="${settlementId}"`);
    this.name = "SettlementPostingNotFoundError";
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettlementSpec {
  date: string;
  settlementId: string;
  service: string; // "GoFood" | "ShopeeFood" | "GrabFood"
  totalGross: bigint; // sum of the settled transactions' totals
  commissionAmount: bigint;
  deductionsTotal: bigint; // sum of SettlementDeduction amounts
  finalAmount: bigint; // what the platform actually paid
  cashAccount: string; // Assets:Cash:<akun> the payout landed in
}

export interface PostedSettlement {
  journalEntryId: string;
  lines: { account: string; amount: bigint }[];
}

export interface SettlementPostingRow {
  journalEntryId: string;
}

interface SettlementSourceMeta {
  service: string;
  totalGross: string;
  commissionAmount: string;
  deductionsTotal: string;
  finalAmount: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Plain Rupiah digits with thousands dots, e.g. 1000000 -> "Rp 1.000.000". */
function rupiah(n: bigint): string {
  const abs = n < 0n ? -n : n;
  const digits = abs.toString();
  const withDots = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `Rp ${n < 0n ? "-" : ""}${withDots}`;
}

function validate(spec: SettlementSpec): void {
  if (
    spec.totalGross < 0n ||
    spec.commissionAmount < 0n ||
    spec.deductionsTotal < 0n ||
    spec.finalAmount < 0n
  ) {
    throw new InvalidSettlementError("Jumlah pencairan tidak boleh negatif.");
  }
  const receivedSide = spec.finalAmount + spec.commissionAmount + spec.deductionsTotal;
  if (receivedSide !== spec.totalGross) {
    throw new SettlementImbalanceError(
      spec.totalGross,
      spec.finalAmount,
      spec.commissionAmount,
      spec.deductionsTotal,
    );
  }
}

function buildLines(spec: SettlementSpec): { account: string; amount: bigint }[] {
  const lines: { account: string; amount: bigint }[] = [];

  if (spec.finalAmount > 0n) {
    lines.push({ account: spec.cashAccount, amount: spec.finalAmount });
  }

  const komisi = spec.commissionAmount + spec.deductionsTotal;
  if (komisi > 0n) {
    lines.push({ account: "Expenses:Operasional:KomisiOnline", amount: komisi });
  }

  if (spec.totalGross > 0n) {
    lines.push({ account: "Income:Sales:Online", amount: -spec.totalGross });
  }

  return lines;
}

function buildSourceMeta(spec: SettlementSpec): SettlementSourceMeta {
  return {
    service: spec.service,
    totalGross: spec.totalGross.toString(),
    commissionAmount: spec.commissionAmount.toString(),
    deductionsTotal: spec.deductionsTotal.toString(),
    finalAmount: spec.finalAmount.toString(),
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class SettlementPostingRepository {
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

  async postSettlement(spec: SettlementSpec): Promise<PostedSettlement> {
    validate(spec);

    const existing = await this.getPostingFor(spec.settlementId);
    if (existing) throw new SettlementAlreadyPostedError(spec.date);

    const lines = buildLines(spec);
    const sourceMeta = buildSourceMeta(spec);
    const narration = `Pencairan ${spec.service} ${spec.date}`;

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
            sourceType: "settlement",
            sourceMeta: sourceMeta as unknown as Prisma.InputJsonValue,
          },
        });
        await tx.ledgerPosting.create({
          data: {
            sourceType: "settlement",
            sourceId: spec.settlementId,
            journalEntryId: entry.id,
          },
        });
        return entry;
      });

      return { journalEntryId: posted.id, lines: posted.lines };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new SettlementAlreadyPostedError(spec.date);
      }
      throw e;
    }
  }

  /** Void the entry and delete the correlation row, so the pencairan can be re-entered. */
  async voidSettlement(settlementId: string): Promise<void> {
    const existing = await this.getPostingFor(settlementId);
    if (!existing) throw new SettlementPostingNotFoundError(settlementId);

    await this.accounting.warmLock();
    await this.prisma.$transaction(async (tx) => {
      await this.accounting.voidEntryTx(tx, existing.journalEntryId);
      await tx.ledgerPosting.delete({
        where: { sourceType_sourceId: { sourceType: "settlement", sourceId: settlementId } },
      });
    });
  }

  async getPostingFor(settlementId: string): Promise<SettlementPostingRow | null> {
    const row = await this.prisma.ledgerPosting.findUnique({
      where: { sourceType_sourceId: { sourceType: "settlement", sourceId: settlementId } },
      select: { journalEntryId: true },
    });
    return row ? { journalEntryId: row.journalEntryId } : null;
  }
}
