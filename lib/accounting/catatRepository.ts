/**
 * catatRepository.ts — Guided Catat siblings: Transfer · Modal · Prive · Saldo Awal
 * (Slice 25b, ACCOUNTING_WB_PLAN 3c / 5b).
 *
 * One shared pattern, exactly WB:
 * - Transfer Antar Kas: Dr Assets:Cash:{ke} / Cr Assets:Cash:{dari}, guard dari ≠ ke.
 * - Modal:              Dr kas / Cr Equity:Modal.
 * - Prive:              Dr Equity:Prive / Cr kas.
 * - Saldo Awal:         Dr kas / Cr Equity:Opening (+ hasPriorEntries flag for the
 *                       "berisiko dobel-hitung kas" warning banner).
 *
 * All entries post through the EXISTING engine (postEntryTx) inside ONE
 * $transaction, tagged sourceType ("transfer"|"modal"|"prive"|"saldo-awal") +
 * sourceMeta. Edit = void + repost (one tx, sourceMeta.replacesId); Hapus = void
 * — same semantics as pengeluaran (25a inherits, plan 5f).
 *
 * Money = BigInt Rupiah. The month lock (F-7) is enforced at the postEntryTx
 * choke point via the forwarded AccountingRepoOptions.
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

export class SameAccountError extends DomainError {
  constructor() {
    super("Akun asal dan tujuan transfer tidak boleh sama.");
    this.name = "SameAccountError";
  }
}

export class InvalidCatatError extends DomainError {
  constructor(reason: string) {
    super(reason);
    this.name = "InvalidCatatError";
  }
}

export class CatatEntryNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Entri "${id}" tidak ditemukan.`);
    this.name = "CatatEntryNotFoundError";
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CatatSourceType = "transfer" | "modal" | "prive" | "saldo-awal";

export interface RecordTransferInput {
  date: string;
  /** e.g. "Assets:Cash:Warung" */
  dari: string;
  /** e.g. "Assets:Cash:Mandiri" */
  ke: string;
  jumlah: bigint;
  catatan?: string;
}

export interface RecordModalInput {
  date: string;
  /** Investor / nama penyetor (stored in sourceMeta, no relation — plan Section 8). */
  nama: string;
  akun: string;
  jumlah: bigint;
  catatan?: string;
}

export interface RecordPriveInput {
  date: string;
  akun: string;
  jumlah: bigint;
  catatan?: string;
}

export interface RecordSaldoAwalInput {
  date: string;
  akun: string;
  jumlah: bigint;
}

export interface CatatRow {
  id: string;
  number: number;
  sourceType: CatatSourceType;
  date: string;
  jumlah: bigint;
  narration: string;
  /** Raw sourceMeta fields for column rendering (dari/ke/akun/nama/catatan…). */
  meta: Record<string, unknown>;
  replacesId: string | null;
}

export interface RecordSaldoAwalResult {
  row: CatatRow;
  /** True when POSTED entries dated before this saldo awal already exist —
   *  WB's "berisiko dobel-hitung kas" warning banner. */
  hasPriorEntries: boolean;
}

export interface ListCatatOptions {
  dateFrom?: string;
  dateTo?: string;
}

const EQUITY = {
  modal: "Equity:Modal",
  prive: "Equity:Prive",
  opening: "Equity:Opening",
} as const;

interface PostSpec {
  sourceType: CatatSourceType;
  date: string;
  narration: string;
  lines: { account: string; amount: bigint }[];
  meta: Record<string, unknown>;
}

function assertKas(account: string, label: string): void {
  if (!account.startsWith("Assets:Cash:")) {
    throw new InvalidCatatError(`Akun ${label} tidak valid (harus akun kas).`);
  }
}

function assertPositive(jumlah: bigint): void {
  if (jumlah <= 0n) throw new InvalidCatatError("Jumlah harus lebih dari 0.");
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class CatatRepository {
  private readonly accounting: AccountingRepository;

  constructor(
    private readonly prisma: PrismaClient,
    accountingOptions: AccountingRepoOptions = {},
  ) {
    // No explicit provider -> default to the live AccountingMonth lock boundary.
    this.accounting = new AccountingRepository(prisma, {
      ...accountingOptions,
      lockedUntilProvider:
        accountingOptions.lockedUntilProvider ?? monthLockOptions(prisma).lockedUntilProvider,
    });
  }

  // -------------------------------------------------------------------------
  // Shared internals
  // -------------------------------------------------------------------------

  private async postTagged(spec: PostSpec): Promise<CatatRow> {
    await this.accounting.warmLock();
    const entry = await this.prisma.$transaction(async (tx) => {
      const posted = await this.accounting.postEntryTx(tx, {
        date: spec.date,
        narration: spec.narration,
        lines: spec.lines,
      });
      await tx.journalEntry.update({
        where: { id: posted.id },
        data: {
          sourceType: spec.sourceType,
          sourceMeta: spec.meta as Prisma.InputJsonValue,
        },
      });
      return posted;
    });

    return {
      id: entry.id,
      number: entry.number,
      sourceType: spec.sourceType,
      date: entry.date,
      jumlah: BigInt(spec.meta["jumlah"] as string),
      narration: entry.narration,
      meta: spec.meta,
      replacesId: (spec.meta["replacesId"] as string | undefined) ?? null,
    };
  }

  private buildSpec(
    sourceType: CatatSourceType,
    input: RecordTransferInput | RecordModalInput | RecordPriveInput | RecordSaldoAwalInput,
  ): PostSpec {
    switch (sourceType) {
      case "transfer": {
        const i = input as RecordTransferInput;
        assertPositive(i.jumlah);
        assertKas(i.dari, "asal");
        assertKas(i.ke, "tujuan");
        if (i.dari === i.ke) throw new SameAccountError();
        return {
          sourceType,
          date: i.date,
          narration: `Transfer kas (${i.dari} → ${i.ke})`,
          lines: [
            { account: i.ke, amount: i.jumlah },
            { account: i.dari, amount: -i.jumlah },
          ],
          meta: {
            dari: i.dari,
            ke: i.ke,
            jumlah: i.jumlah.toString(),
            catatan: i.catatan?.trim() || null,
          },
        };
      }
      case "modal": {
        const i = input as RecordModalInput;
        assertPositive(i.jumlah);
        assertKas(i.akun, "kas");
        if (!i.nama.trim()) throw new InvalidCatatError("Nama penyetor wajib diisi.");
        return {
          sourceType,
          date: i.date,
          narration: `Setoran modal ${i.nama.trim()} (${i.akun})`,
          lines: [
            { account: i.akun, amount: i.jumlah },
            { account: EQUITY.modal, amount: -i.jumlah },
          ],
          meta: {
            nama: i.nama.trim(),
            akun: i.akun,
            jumlah: i.jumlah.toString(),
            catatan: i.catatan?.trim() || null,
          },
        };
      }
      case "prive": {
        const i = input as RecordPriveInput;
        assertPositive(i.jumlah);
        assertKas(i.akun, "kas");
        return {
          sourceType,
          date: i.date,
          narration: `Prive (${i.akun})`,
          lines: [
            { account: EQUITY.prive, amount: i.jumlah },
            { account: i.akun, amount: -i.jumlah },
          ],
          meta: {
            akun: i.akun,
            jumlah: i.jumlah.toString(),
            catatan: i.catatan?.trim() || null,
          },
        };
      }
      case "saldo-awal": {
        const i = input as RecordSaldoAwalInput;
        assertPositive(i.jumlah);
        assertKas(i.akun, "kas");
        return {
          sourceType,
          date: i.date,
          narration: `Saldo awal (${i.akun})`,
          lines: [
            { account: i.akun, amount: i.jumlah },
            { account: EQUITY.opening, amount: -i.jumlah },
          ],
          meta: {
            akun: i.akun,
            jumlah: i.jumlah.toString(),
          },
        };
      }
    }
  }

  // -------------------------------------------------------------------------
  // Record
  // -------------------------------------------------------------------------

  async recordTransfer(input: RecordTransferInput): Promise<CatatRow> {
    return this.postTagged(this.buildSpec("transfer", input));
  }

  async recordModal(input: RecordModalInput): Promise<CatatRow> {
    return this.postTagged(this.buildSpec("modal", input));
  }

  async recordPrive(input: RecordPriveInput): Promise<CatatRow> {
    return this.postTagged(this.buildSpec("prive", input));
  }

  /**
   * Record saldo awal + return hasPriorEntries for the WB warning banner
   * ("berisiko dobel-hitung kas" when POSTED entries exist before this date).
   */
  async recordSaldoAwal(input: RecordSaldoAwalInput): Promise<RecordSaldoAwalResult> {
    const hasPriorEntries = await this.hasPriorEntries(input.date);
    const row = await this.postTagged(this.buildSpec("saldo-awal", input));
    return { row, hasPriorEntries };
  }

  /** True when any POSTED entry exists dated strictly before `date`. */
  async hasPriorEntries(date: string): Promise<boolean> {
    const count = await this.prisma.journalEntry.count({
      where: { state: "POSTED", date: { lt: date } },
    });
    return count > 0;
  }

  // -------------------------------------------------------------------------
  // List (month-scoped, per sourceType)
  // -------------------------------------------------------------------------

  async listCatat(
    sourceType: CatatSourceType,
    options: ListCatatOptions = {},
  ): Promise<CatatRow[]> {
    const where: {
      sourceType: string;
      state: { not: "VOID" };
      date?: { gte?: string; lte?: string };
    } = { sourceType, state: { not: "VOID" } };
    if (options.dateFrom || options.dateTo) {
      where.date = {};
      if (options.dateFrom) where.date.gte = options.dateFrom;
      if (options.dateTo) where.date.lte = options.dateTo;
    }

    const entries = await this.prisma.journalEntry.findMany({
      where,
      orderBy: [{ date: "desc" }, { number: "desc" }],
    });

    return entries
      .map((e) => {
        const meta = e.sourceMeta as Record<string, unknown> | null;
        if (!meta) return null;
        return {
          id: e.id,
          number: e.number ?? 0,
          sourceType,
          date: e.date,
          jumlah: BigInt(meta["jumlah"] as string),
          narration: e.narration,
          meta,
          replacesId: (meta["replacesId"] as string | undefined) ?? null,
        } satisfies CatatRow;
      })
      .filter((r): r is CatatRow => r !== null);
  }

  // -------------------------------------------------------------------------
  // Edit (void + repost, ONE tx) & Hapus (void)
  // -------------------------------------------------------------------------

  async editCatat(
    id: string,
    sourceType: CatatSourceType,
    input: RecordTransferInput | RecordModalInput | RecordPriveInput | RecordSaldoAwalInput,
  ): Promise<CatatRow> {
    const original = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!original || original.sourceType !== sourceType || original.state !== "POSTED") {
      throw new CatatEntryNotFoundError(id);
    }

    const spec = this.buildSpec(sourceType, input);
    spec.meta["replacesId"] = id;

    const entry = await this.prisma.$transaction(async (tx) => {
      // 1. Void original (reversal + mark VOID) inside this same tx
      const reversal = await this.accounting.postEntryTx(tx, {
        date: original.date,
        narration: `[Reversal] ${original.narration}`,
        lines: original.lines.map((l) => ({ account: l.account, amount: -l.amount })),
      });
      await tx.journalEntry.update({
        where: { id },
        data: { reversedById: reversal.id, state: "VOID" as const },
      });

      // 2. Post corrected, linked via sourceMeta.replacesId
      const posted = await this.accounting.postEntryTx(tx, {
        date: spec.date,
        narration: spec.narration,
        lines: spec.lines,
      });
      await tx.journalEntry.update({
        where: { id: posted.id },
        data: {
          sourceType: spec.sourceType,
          sourceMeta: spec.meta as Prisma.InputJsonValue,
        },
      });
      return posted;
    });

    return {
      id: entry.id,
      number: entry.number,
      sourceType,
      date: entry.date,
      jumlah: BigInt(spec.meta["jumlah"] as string),
      narration: entry.narration,
      meta: spec.meta,
      replacesId: id,
    };
  }

  async voidCatat(id: string, sourceType: CatatSourceType): Promise<void> {
    const original = await this.prisma.journalEntry.findUnique({ where: { id } });
    if (!original || original.sourceType !== sourceType) {
      throw new CatatEntryNotFoundError(id);
    }
    await this.accounting.voidEntry(id);
  }

  // -------------------------------------------------------------------------
  // listMonths — Manajemen Bulan table (plan 3e): entri counts + rincian per
  // sourceType, across ALL tagged sourceTypes (pengeluaran + the 4 siblings).
  // Lock status itself lives on control-plane StoreSettings.lockedUntil — the
  // web layer joins that in (this repo only sees the data-plane journal).
  // -------------------------------------------------------------------------

  async listMonths(): Promise<MonthSummary[]> {
    const entries = await this.prisma.journalEntry.findMany({
      where: { sourceType: { not: null }, state: { not: "VOID" } },
      select: { date: true, sourceType: true },
    });

    const byMonth = new Map<string, Record<string, number>>();
    for (const e of entries) {
      const month = e.date.slice(0, 7);
      const bucket = byMonth.get(month) ?? {};
      const st = e.sourceType ?? "lain";
      bucket[st] = (bucket[st] ?? 0) + 1;
      byMonth.set(month, bucket);
    }

    return [...byMonth.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, rincian]) => ({
        month,
        entryCount: Object.values(rincian).reduce((acc, n) => acc + n, 0),
        rincian,
      }));
  }
}

export interface MonthSummary {
  /** "YYYY-MM" */
  month: string;
  entryCount: number;
  /** sourceType -> non-void entry count for that month. */
  rincian: Record<string, number>;
}
