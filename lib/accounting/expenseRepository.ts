/**
 * expenseRepository.ts — Pengeluaran + Kategori Pengeluaran persistence.
 *
 * Adapted from Padu for tokokencana (single-store; Padu's `storeId` and the
 * COGS/ingredient bahan-linking are dropped). HPP is a plain expense bucket fed
 * by the pengeluaran recorded here — bahan baku purchases, on a cash basis —
 * and NEVER by a per-sale cost: kasir has no hargaModal concept, and nothing is
 * tracked as a quantity-bearing asset. See lib/accounting/chart-of-accounts.ts.
 *
 * Design invariants:
 * - ExpenseCategory is a module-owned table; pengeluaran posts through the
 *   EXISTING engine (postEntryTx / voidEntry) — the ledger core is untouched.
 * - Posting shape: Dr Expenses:{HPP|OpEx}:{KODE} / Cr Assets:Cash:{akun},
 *   narration "Beban {KODE} ({akun})". sourceType="pengeluaran"; sourceMeta
 *   stashes the form fields the list view renders.
 * - Edit = void original + post corrected, ONE $transaction, linked via
 *   sourceMeta.replacesId. Hapus = void (POSTED reversal, original marked VOID).
 * - Money = BigInt Rupiah. `jumlah` is authoritative — never re-derived from
 *   qty x harga server-side (that multiplication is display prefill only).
 */

import { PrismaClient, Prisma, ExpenseBucket } from "@/generated/prisma";
import {
  AccountingRepository,
  type PostedEntry,
  type AccountingRepoOptions,
} from "./accountingRepository";
import { monthLockOptions } from "./monthLock";
import { DomainError } from "../errors";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class CategoryInUseError extends DomainError {
  constructor(code: string) {
    super(`Kategori "${code}" masih dipakai oleh transaksi pengeluaran — nonaktifkan saja.`);
    this.name = "CategoryInUseError";
  }
}

export class CategoryNotFoundError extends DomainError {
  constructor(idOrCode: string) {
    super(`Kategori pengeluaran "${idOrCode}" tidak ditemukan.`);
    this.name = "CategoryNotFoundError";
  }
}

export class DuplicateCategoryCodeError extends DomainError {
  constructor(code: string) {
    super(`Kode kategori "${code}" sudah dipakai.`);
    this.name = "DuplicateCategoryCodeError";
  }
}

export class InvalidPengeluaranError extends DomainError {
  constructor(reason: string) {
    super(reason);
    this.name = "InvalidPengeluaranError";
  }
}

export class CategoryInactiveError extends DomainError {
  constructor(code: string) {
    super(`Kategori "${code}" sudah nonaktif — aktifkan kembali untuk mencatat pengeluaran baru.`);
    this.name = "CategoryInactiveError";
  }
}

export class PengeluaranNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Pengeluaran "${id}" tidak ditemukan.`);
    this.name = "PengeluaranNotFoundError";
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExpenseBucketKey = "HPP" | "OPEX";

export interface ExpenseCategoryRow {
  id: string;
  code: string;
  name: string;
  bucket: ExpenseBucketKey;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExpenseCategoryInput {
  code: string;
  name: string;
  bucket: ExpenseBucketKey;
}

export interface UpdateExpenseCategoryInput {
  name?: string;
  active?: boolean;
  // code is intentionally NOT editable — immutable after create.
}

export interface RecordPengeluaranInput {
  date: string;
  akun: string; // e.g. "Assets:Cash:Utama"
  item: string;
  qty: number | string; // decimal allowed, display/audit only
  hargaSatuan: bigint;
  jumlah: bigint; // AUTHORITATIVE — server never multiplies floats
  kategoriCode: string;
  createdBy?: string;
}

export interface PengeluaranRow {
  id: string;
  number: number;
  date: string;
  akun: string;
  item: string;
  qty: number | string;
  hargaSatuan: bigint;
  jumlah: bigint;
  kategoriCode: string;
  kategoriNama: string | null;
  kategoriBucket: ExpenseBucketKey | null;
  narration: string;
  state: string;
  replacesId: string | null;
}

export interface ListPengeluaranOptions {
  dateFrom?: string;
  dateTo?: string;
  /** Include VOID entries (with their state) — laporan needs these so a
   *  voided pengeluaran plus its reversal nets to zero rather than vanishing
   *  from the ledger view. Defaults to false (existing Keuangan behaviour). */
  includeVoid?: boolean;
}

export interface EditPengeluaranInput {
  date: string;
  akun: string;
  item: string;
  qty: number | string;
  hargaSatuan: bigint;
  jumlah: bigint;
  kategoriCode: string;
  createdBy?: string;
}

interface PengeluaranSourceMeta {
  item: string;
  qty: number | string;
  hargaSatuan: string; // BigInt serialized as string in JSON
  jumlah: string; // BigInt serialized as string — AUTHORITATIVE posted amount
  kategoriCode: string;
  akun: string;
  replacesId?: string;
}

// ---------------------------------------------------------------------------
// Default kategori seeds (electrical-goods retail)
// ---------------------------------------------------------------------------

const DEFAULT_CATEGORIES: Array<{ code: string; name: string; bucket: ExpenseBucketKey }> = [
  { code: "KULAKAN", name: "Kulakan (stok barang)", bucket: "HPP" },
  { code: "LISTRIK", name: "Listrik", bucket: "OPEX" },
  { code: "GAJI", name: "Gaji", bucket: "OPEX" },
  { code: "SEWA", name: "Sewa", bucket: "OPEX" },
  { code: "ONGKIR", name: "Ongkir", bucket: "OPEX" },
  { code: "LAIN", name: "Lain-lain", bucket: "OPEX" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bucketPrefix(bucket: ExpenseBucketKey): string {
  return bucket === "HPP" ? "Expenses:HPP" : "Expenses:OpEx";
}

function mapCategory(row: {
  id: string;
  code: string;
  name: string;
  bucket: ExpenseBucket;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ExpenseCategoryRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    bucket: row.bucket as ExpenseBucketKey,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class ExpenseRepository {
  private readonly accounting: AccountingRepository;

  constructor(
    private readonly prisma: PrismaClient,
    accountingOptions: AccountingRepoOptions = {},
  ) {
    // Forward the lock provider so record/edit/void hit the month-lock guard.
    // No explicit provider -> default to the live AccountingMonth lock boundary.
    this.accounting = new AccountingRepository(prisma, {
      ...accountingOptions,
      lockedUntilProvider:
        accountingOptions.lockedUntilProvider ?? monthLockOptions(prisma).lockedUntilProvider,
    });
  }

  // -------------------------------------------------------------------------
  // ensureDefaultCategories — idempotent, safe to call from an RSC
  // -------------------------------------------------------------------------

  // `skipDuplicates` is what makes this idempotent, so it must run even when
  // categories already exist — otherwise a default the owner deleted by mistake
  // can never be restored, and the UI reports a success that did nothing.
  async ensureDefaultCategories(): Promise<void> {
    await this.prisma.expenseCategory.createMany({
      data: DEFAULT_CATEGORIES.map((s) => ({
        code: s.code,
        name: s.name,
        bucket: s.bucket,
      })),
      skipDuplicates: true,
    });
  }

  // -------------------------------------------------------------------------
  // Kategori CRUD
  // -------------------------------------------------------------------------

  async listCategories(): Promise<ExpenseCategoryRow[]> {
    const rows = await this.prisma.expenseCategory.findMany({ orderBy: { code: "asc" } });
    return rows.map(mapCategory);
  }

  async createCategory(input: CreateExpenseCategoryInput): Promise<ExpenseCategoryRow> {
    const code = input.code.trim().toUpperCase();
    if (!code) throw new InvalidPengeluaranError("Kode kategori wajib diisi.");
    if (!input.name.trim()) throw new InvalidPengeluaranError("Nama kategori wajib diisi.");

    try {
      const row = await this.prisma.expenseCategory.create({
        data: { code, name: input.name.trim(), bucket: input.bucket },
      });
      return mapCategory(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new DuplicateCategoryCodeError(code);
      }
      throw e;
    }
  }

  async updateCategory(id: string, input: UpdateExpenseCategoryInput): Promise<ExpenseCategoryRow> {
    const existing = await this.prisma.expenseCategory.findUnique({ where: { id } });
    if (!existing) throw new CategoryNotFoundError(id);

    const row = await this.prisma.expenseCategory.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.active !== undefined && { active: input.active }),
      },
    });
    return mapCategory(row);
  }

  /**
   * Delete a category. Blocked with CategoryInUseError if any non-void
   * "pengeluaran" entry references this code — caller offers nonaktif instead.
   */
  async deleteCategory(id: string): Promise<void> {
    const category = await this.prisma.expenseCategory.findUnique({ where: { id } });
    if (!category) throw new CategoryNotFoundError(id);

    if (await this.isCategoryInUse(category.code)) {
      throw new CategoryInUseError(category.code);
    }
    await this.prisma.expenseCategory.delete({ where: { id } });
  }

  private async isCategoryInUse(code: string): Promise<boolean> {
    // sourceMeta is JSON; filter in-app (JSON-path filtering is not reliably
    // portable across the pglite test target and prod Postgres).
    const entries = await this.prisma.journalEntry.findMany({
      where: { sourceType: "pengeluaran", state: { not: "VOID" } },
      select: { sourceMeta: true },
    });
    return entries.some((e) => {
      const meta = e.sourceMeta as unknown as PengeluaranSourceMeta | null;
      return meta?.kategoriCode === code;
    });
  }

  // -------------------------------------------------------------------------
  // recordPengeluaran
  // -------------------------------------------------------------------------

  async recordPengeluaran(input: RecordPengeluaranInput): Promise<PengeluaranRow> {
    if (input.jumlah <= 0n) throw new InvalidPengeluaranError("Jumlah harus lebih dari 0.");
    if (input.hargaSatuan < 0n) throw new InvalidPengeluaranError("Harga satuan tidak boleh negatif.");
    if (!input.item.trim()) throw new InvalidPengeluaranError("Item wajib diisi.");
    if (!input.akun.startsWith("Assets:Cash:")) {
      throw new InvalidPengeluaranError("Akun kas tidak valid.");
    }

    const category = await this.prisma.expenseCategory.findUnique({
      where: { code: input.kategoriCode },
    });
    if (!category) throw new CategoryNotFoundError(input.kategoriCode);
    if (!category.active) throw new CategoryInactiveError(input.kategoriCode);

    const expenseAccount = `${bucketPrefix(category.bucket as ExpenseBucketKey)}:${category.code}`;
    const narration = `Beban ${category.code} (${input.akun})`;

    const sourceMeta: PengeluaranSourceMeta = {
      item: input.item.trim(),
      qty: input.qty,
      hargaSatuan: input.hargaSatuan.toString(),
      jumlah: input.jumlah.toString(),
      kategoriCode: category.code,
      akun: input.akun,
    };

    await this.accounting.warmLock();
    const posted = await this.prisma.$transaction(async (tx) => {
      const entry = await this.accounting.postEntryTx(tx, {
        date: input.date,
        narration,
        lines: [
          { account: expenseAccount, amount: input.jumlah },
          { account: input.akun, amount: -input.jumlah },
        ],
      });
      await tx.journalEntry.update({
        where: { id: entry.id },
        data: {
          sourceType: "pengeluaran",
          sourceMeta: sourceMeta as unknown as Prisma.InputJsonValue,
        },
      });
      return entry;
    });

    return this.toPengeluaranRow(
      posted,
      sourceMeta,
      category.name,
      category.bucket as ExpenseBucketKey,
      "POSTED",
    );
  }

  // -------------------------------------------------------------------------
  // listPengeluaran — date-range scoped, joins category
  // -------------------------------------------------------------------------

  async listPengeluaran(options: ListPengeluaranOptions = {}): Promise<PengeluaranRow[]> {
    const where: {
      sourceType: string;
      state: { not: "VOID" } | { in: ("POSTED" | "VOID")[] };
      date?: { gte?: string; lte?: string };
    } = {
      sourceType: "pengeluaran",
      state: options.includeVoid ? { in: ["POSTED", "VOID"] } : { not: "VOID" },
    };

    if (options.dateFrom || options.dateTo) {
      where.date = {};
      if (options.dateFrom) where.date.gte = options.dateFrom;
      if (options.dateTo) where.date.lte = options.dateTo;
    }

    const entries = await this.prisma.journalEntry.findMany({
      where,
      orderBy: [{ date: "desc" }, { number: "desc" }],
    });

    const categories = await this.prisma.expenseCategory.findMany();
    const catByCode = new Map(categories.map((c) => [c.code, c]));

    return entries
      .map((e) => {
        const meta = e.sourceMeta as unknown as PengeluaranSourceMeta | null;
        if (!meta) return null;
        const cat = catByCode.get(meta.kategoriCode);
        return this.toPengeluaranRow(
          { id: e.id, number: e.number ?? 0, date: e.date, narration: e.narration },
          meta,
          cat?.name ?? null,
          (cat?.bucket as ExpenseBucketKey | undefined) ?? null,
          e.state,
        );
      })
      .filter((r): r is PengeluaranRow => r !== null);
  }

  async getPengeluaran(id: string): Promise<PengeluaranRow | null> {
    const e = await this.prisma.journalEntry.findUnique({ where: { id } });
    if (!e || e.sourceType !== "pengeluaran") return null;
    const meta = e.sourceMeta as unknown as PengeluaranSourceMeta | null;
    if (!meta) return null;

    const category = await this.prisma.expenseCategory.findFirst({
      where: { code: meta.kategoriCode },
    });

    return this.toPengeluaranRow(
      { id: e.id, number: e.number ?? 0, date: e.date, narration: e.narration },
      meta,
      category?.name ?? null,
      (category?.bucket as ExpenseBucketKey | undefined) ?? null,
      e.state,
    );
  }

  // -------------------------------------------------------------------------
  // editPengeluaran — void original + post corrected, ONE $transaction
  // -------------------------------------------------------------------------

  async editPengeluaran(id: string, input: EditPengeluaranInput): Promise<PengeluaranRow> {
    if (input.jumlah <= 0n) throw new InvalidPengeluaranError("Jumlah harus lebih dari 0.");
    if (!input.akun.startsWith("Assets:Cash:")) {
      throw new InvalidPengeluaranError("Akun kas tidak valid.");
    }

    const original = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!original || original.sourceType !== "pengeluaran" || original.state !== "POSTED") {
      throw new PengeluaranNotFoundError(id);
    }

    const kategoriCodeUpper = input.kategoriCode.toUpperCase();
    const newMeta: PengeluaranSourceMeta = {
      item: input.item.trim(),
      qty: input.qty,
      hargaSatuan: input.hargaSatuan.toString(),
      jumlah: input.jumlah.toString(),
      kategoriCode: kategoriCodeUpper,
      akun: input.akun,
      replacesId: id,
    };

    let categoryName = "";
    let categoryBucket: ExpenseBucketKey = "OPEX";

    await this.accounting.warmLock();
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Void the original (reversal + mark VOID) inside this same tx, so a
      //    failed repost rolls the void back too (never left half-corrected).
      const reversal = await this.accounting.postEntryTx(tx, {
        date: original.date,
        narration: `[Reversal] ${original.narration}`,
        lines: original.lines.map((l) => ({ account: l.account, amount: -l.amount })),
      });
      await tx.journalEntry.update({
        where: { id },
        data: { reversedById: reversal.id, state: "VOID" as const },
      });

      // 2. Resolve + validate the target category (post-void, still inside tx)
      const category = await tx.expenseCategory.findUnique({ where: { code: kategoriCodeUpper } });
      if (!category) throw new CategoryNotFoundError(input.kategoriCode);
      if (!category.active) throw new CategoryInactiveError(input.kategoriCode);
      categoryName = category.name;
      categoryBucket = category.bucket as ExpenseBucketKey;

      const expenseAccount = `${bucketPrefix(categoryBucket)}:${category.code}`;
      const narration = `Beban ${category.code} (${input.akun})`;

      // 3. Post the corrected entry, linked via sourceMeta.replacesId
      const posted = await this.accounting.postEntryTx(tx, {
        date: input.date,
        narration,
        lines: [
          { account: expenseAccount, amount: input.jumlah },
          { account: input.akun, amount: -input.jumlah },
        ],
      });
      await tx.journalEntry.update({
        where: { id: posted.id },
        data: {
          sourceType: "pengeluaran",
          sourceMeta: newMeta as unknown as Prisma.InputJsonValue,
        },
      });
      return posted;
    });

    return this.toPengeluaranRow(result, newMeta, categoryName, categoryBucket, "POSTED");
  }

  // -------------------------------------------------------------------------
  // voidPengeluaran — Hapus (existing voidEntry semantics)
  // -------------------------------------------------------------------------

  async voidPengeluaran(id: string): Promise<void> {
    const original = await this.prisma.journalEntry.findUnique({ where: { id } });
    if (!original || original.sourceType !== "pengeluaran") {
      throw new PengeluaranNotFoundError(id);
    }
    await this.accounting.voidEntry(id);
  }

  // -------------------------------------------------------------------------
  // Private mapping
  // -------------------------------------------------------------------------

  private toPengeluaranRow(
    entry: { id: string; number: number; date: string; narration: string },
    meta: PengeluaranSourceMeta,
    kategoriNama: string | null,
    kategoriBucket: ExpenseBucketKey | null,
    state: string,
  ): PengeluaranRow {
    return {
      id: entry.id,
      number: entry.number,
      date: entry.date,
      akun: meta.akun,
      item: meta.item,
      qty: meta.qty,
      hargaSatuan: BigInt(meta.hargaSatuan),
      jumlah: BigInt(meta.jumlah),
      kategoriCode: meta.kategoriCode,
      kategoriNama,
      kategoriBucket,
      narration: entry.narration,
      state,
      replacesId: meta.replacesId ?? null,
    };
  }
}

// Re-export for consumers that map bucket enums.
export type { PostedEntry };
