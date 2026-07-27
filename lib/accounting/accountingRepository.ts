/**
 * accountingRepository.ts — Prisma-backed accounting persistence (Warung Books).
 *
 * Design invariants:
 * - Zero-sum is enforced by the core JournalEntry BEFORE any DB write.
 * - Gapless journal numbers are assigned inside a single DB transaction using
 *   `UPDATE sequences SET value = value + 1 RETURNING value`.
 * - Balances are NEVER stored; they are always derived from JournalLine sums.
 * - A POSTED entry's lines may NOT be mutated in place; corrections go through voidEntry.
 * - State machine: DRAFT → POSTED → VOID only.
 *
 * Slice 4 refactor: postEntryTx / voidEntryTx are now tx-aware internal helpers
 * that accept an active Prisma interactive-transaction client. The public methods
 * postEntry / voidEntry wrap them in their own $transaction. This enables
 * posRepository to compose them inside a single outer $transaction for atomicity.
 */

import { PrismaClient, Prisma } from "@/generated/prisma";
import {
  JournalEntry as CoreJournalEntry,
  type JournalLine as CoreJournalLine,
  Book,
} from "./index";
import { nextSequenceTx } from "./sequenceHelper";
import { DomainError } from "../errors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PostEntryInput {
  date: string;
  narration: string;
  lines: CoreJournalLine[];
}

export interface PostedEntry {
  id: string;
  number: number;
  date: string;
  narration: string;
  lines: CoreJournalLine[];
  state: "POSTED";
}

export interface LoadBookOptions {
  dateFrom?: string;
  dateTo?: string;
}

/** Single journal entry with its lines — read-only detail view (S23b F-15). */
export interface JournalEntryDetail {
  id: string;
  number: number;
  date: string;
  narration: string;
  state: string;
  lines: { account: string; amount: bigint }[];
}

/**
 * Reverse lookup: given a JournalEntry id, find the operational document that
 * posted it. tokokencana keeps NO journalEntryId column on operational rows —
 * the correlation lives in the LedgerPosting table (sourceType/sourceId →
 * journalEntryId). Best-effort: returns null if no posting references this JE
 * (e.g. a manual "Penyesuaian" entry, which is its own source).
 */
export interface JournalEntrySource {
  type: "kasir" | "order" | "purchase";
  sourceId: string;
  label: string;
  href: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class UnbalancedEntryError extends Error {
  constructor(sum: bigint) {
    super(`JournalEntry lines do not sum to zero (sum=${sum})`);
    this.name = "UnbalancedEntryError";
  }
}

export class IllegalStateTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Illegal state transition: ${from} → ${to}`);
    this.name = "IllegalStateTransitionError";
  }
}

export class EntryNotFoundError extends Error {
  constructor(id: string) {
    super(`JournalEntry id=${id} not found`);
    this.name = "EntryNotFoundError";
  }
}

/** S25b F-7: posting into a locked month (entry date ≤ lockedUntil boundary). */
export class PeriodLockedError extends DomainError {
  constructor(date: string, lockedUntil: string) {
    super(
      `Bulan ini sudah ditutup — entri tanggal ${date} berada dalam periode terkunci (s/d ${lockedUntil}). Buka kembali bulan tersebut untuk mengubahnya.`,
    );
    this.name = "PeriodLockedError";
  }
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * S25b F-7 month lock: lockedUntil lives on the CONTROL-plane StoreSettings,
 * while this repository holds a DATA-plane client — so the boundary is
 * injected as a provider rather than queried directly. The web layer wires it
 * to controlRepo.getStoreSettings(storeId).lockedUntil; composing repos
 * (POS, purchase, expense, catat, fnb) forward the same options object, so
 * postEntryTx stays the ONE choke point for every money path.
 */
export interface AccountingRepoOptions {
  /** Returns the lock boundary (inclusive) or null when nothing is locked. */
  lockedUntilProvider?: () => Promise<Date | string | null>;
}

/** Normalize a Date or ISO string to "YYYY-MM-DD" for boundary comparison. */
function toIsoDay(v: Date | string): string {
  if (typeof v === "string") return v.slice(0, 10);
  return v.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class AccountingRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly options: AccountingRepoOptions = {},
  ) {}

  /**
   * F-7 guard — the single lock choke point. Called from postEntryTx (which
   * every poster composes through) and voidEntry (which creates its reversal
   * lines directly). Throws PeriodLockedError when date ≤ lockedUntil.
   * Boundary semantics: entries dated ON the boundary are locked; entries
   * dated after it post normally.
   */
  private async assertNotLocked(date: string): Promise<void> {
    if (!this.options.lockedUntilProvider) return;
    const boundary = await this.options.lockedUntilProvider();
    if (!boundary) return;
    const boundaryDay = toIsoDay(boundary);
    if (toIsoDay(date) <= boundaryDay) {
      throw new PeriodLockedError(date, boundaryDay);
    }
  }

  /**
   * Pre-resolves `lockedUntilProvider` OUTSIDE any transaction. Callers that
   * wrap `postEntryTx` in their OWN `prisma.$transaction(...)` (every posting
   * repository does this) MUST `await this.accounting.warmLock()` before
   * opening that transaction.
   *
   * Why: assertNotLocked runs its provider call from INSIDE the transaction
   * (via postEntryTx). The default provider (monthLockOptions) queries the
   * plain, non-tx Prisma client. Against a real pooled Postgres that's a
   * harmless separate connection; against pglite (single in-process
   * connection, used by the test suite) a query on the plain client issued
   * while a transaction already holds the one connection has nowhere to go —
   * it hangs until the transaction's own timeout kills it. Resolving the
   * provider here, before BEGIN is ever sent, avoids that entirely; once
   * resolved, the provider is cheap to call again from inside the tx.
   */
  async warmLock(): Promise<void> {
    if (this.options.lockedUntilProvider) {
      await this.options.lockedUntilProvider();
    }
  }

  // -------------------------------------------------------------------------
  // TX-AWARE INTERNAL HELPERS (accept a Prisma interactive-tx client)
  // These are used by posRepository to compose inside a single outer tx.
  // -------------------------------------------------------------------------

  /**
   * Post a new journal entry inside an existing transaction.
   *
   * 1. Build a @padu/core JournalEntry — enforces zero-sum invariant.
   * 2. Atomically assign gapless number via nextSequenceTx.
   * 3. Create the POSTED entry + lines.
   *
   * The caller must pass an active Prisma interactive-transaction client.
   */
  async postEntryTx(tx: Prisma.TransactionClient, input: PostEntryInput): Promise<PostedEntry> {
    // F-7: reject posts into a locked month (one choke point for all posters)
    await this.assertNotLocked(input.date);

    // Enforce zero-sum via @padu/core (throws if unbalanced)
    const coreEntry = new CoreJournalEntry(
      input.date,
      input.narration,
      input.lines,
    );

    const now = new Date();

    // Atomically assign gapless number
    const number = await nextSequenceTx(tx, "journal");

    const entry = await tx.journalEntry.create({
      data: {
        number,
        state: "POSTED",
        date: coreEntry.date,
        narration: coreEntry.narration,
        postedAt: now,
        lines: {
          create: coreEntry.postings.map((p: CoreJournalLine) => ({
            account: p.account,
            amount: p.amount,
          })),
        },
      },
      include: { lines: true },
    });

    return {
      id: entry.id,
      number,
      date: entry.date,
      narration: entry.narration,
      state: "POSTED",
      lines: entry.lines.map((l: { account: string; amount: bigint }) => ({
        account: l.account,
        amount: l.amount,
      })),
    };
  }

  // -------------------------------------------------------------------------
  // PUBLIC METHODS (wrap the tx-aware helpers in their own $transaction)
  // -------------------------------------------------------------------------

  /**
   * Post a new journal entry.
   *
   * 1. Build a @padu/core JournalEntry first — this enforces zero-sum invariant
   *    before touching the DB.
   * 2. Inside a single transaction:
   *    a. Atomically increment the "journal" sequence.
   *    b. Persist the entry as POSTED with its lines.
   * 3. Return the entry with its assigned gapless number.
   */
  async postEntry(input: PostEntryInput): Promise<PostedEntry> {
    await this.warmLock();
    return this.prisma.$transaction(async (tx) => {
      return this.postEntryTx(tx, input);
    });
  }

  /**
   * Load all POSTED and VOID entries and construct a @padu/core Book.
   * Balances are derived by summing lines — never stored.
   *
   * Why include VOID entries?
   *   When voidEntry() runs, it (a) marks the original as VOID and (b) creates a
   *   POSTED reversal with negated lines. Both entries remain in the ledger as an
   *   immutable audit trail. Their lines cancel each other (original + reversal = 0),
   *   so including VOID entries in the balance sum is correct — the net effect on
   *   balances is zero, exactly as intended. Excluding VOID entries would instead
   *   leave the reversal's lines in isolation and produce wrong balances.
   *
   *   This mirrors Odoo's behaviour: reversed entries stay POSTED; the reversal is
   *   a separate POSTED entry; together they net to zero in the trial balance.
   *
   * DRAFT entries are excluded (they have not been committed to the ledger yet).
   */
  async loadBook(options: LoadBookOptions = {}): Promise<Book> {
    const where: {
      state?: { in: Array<"POSTED" | "VOID"> };
      date?: { gte?: string; lte?: string };
    } = { state: { in: ["POSTED", "VOID"] } };

    if (options.dateFrom || options.dateTo) {
      where.date = {};
      if (options.dateFrom) where.date.gte = options.dateFrom;
      if (options.dateTo) where.date.lte = options.dateTo;
    }

    const entries = await this.prisma.journalEntry.findMany({
      where,
      include: { lines: true },
      orderBy: [{ date: "asc" }, { number: "asc" }],
    });

    const coreEntries: CoreJournalEntry[] = entries.map((e) =>
      new CoreJournalEntry(
        e.date,
        e.narration,
        e.lines.map((l) => ({ account: l.account, amount: l.amount })),
        { id: e.id }, // e.id is now a string cuid
      ),
    );

    return new Book(coreEntries);
  }

  /**
   * Void a POSTED entry by:
   * 1. Asserting state == POSTED (throws on illegal transition).
   * 2. Creating a reversing entry (negated lines, its own gapless number).
   * 3. Marking the original as VOID and linking the two.
   *
   * Lines may NOT be edited in place; this is the only correction path.
   */
  async voidEntry(id: string): Promise<PostedEntry> {
    await this.warmLock();
    return this.prisma.$transaction(async (tx) => {
      const original = await tx.journalEntry.findUnique({
        where: { id },
        include: { lines: true },
      });

      if (!original) throw new EntryNotFoundError(id);
      // F-7: voiding writes a reversal into the original's month — blocked
      // when that month is locked (Edit/Hapus blocked in locked months).
      await this.assertNotLocked(original.date);
      if (original.state !== "POSTED") {
        throw new IllegalStateTransitionError(original.state, "VOID");
      }

      // Build reversed lines
      const reversedLines: CoreJournalLine[] = original.lines.map((l) => ({
        account: l.account,
        amount: -l.amount,
      }));

      // Validate zero-sum on the reversal (should always hold but be safe)
      const reversalEntry = new CoreJournalEntry(
        original.date,
        `[Reversal] ${original.narration}`,
        reversedLines,
      );

      // Atomically get next sequence number
      const number = await nextSequenceTx(tx, "journal");

      const now = new Date();

      // Create the reversing entry
      const reversal = await tx.journalEntry.create({
        data: {
          number,
          state: "POSTED",
          date: reversalEntry.date,
          narration: reversalEntry.narration,
          postedAt: now,
          reversedById: id,
          lines: {
            create: reversalEntry.postings.map((p) => ({
              account: p.account,
              amount: p.amount,
            })),
          },
        },
        include: { lines: true },
      });

      // Mark original as VOID
      await tx.journalEntry.update({
        where: { id },
        data: { state: "VOID" },
      });

      return {
        id: reversal.id,
        number,
        date: reversal.date,
        narration: reversal.narration,
        state: "POSTED",
        lines: reversal.lines.map((l) => ({
          account: l.account,
          amount: l.amount,
        })),
      };
    });
  }

  /**
   * Load a single journal entry (any state) with its lines, for the read-only
   * jurnal detail view. Returns null if not found. (S23b F-15)
   */
  async getEntryById(id: string): Promise<JournalEntryDetail | null> {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!entry) return null;

    return {
      id: entry.id,
      number: entry.number ?? 0,
      date: entry.date,
      narration: entry.narration,
      state: entry.state,
      lines: entry.lines.map((l) => ({ account: l.account, amount: l.amount })),
    };
  }

  /**
   * Create a DRAFT entry (not yet posted, no number assigned).
   * Useful for staging entries before posting.
   */
  async createDraft(input: PostEntryInput): Promise<{ id: string }> {
    // Still enforce zero-sum before writing
    new CoreJournalEntry(input.date, input.narration, input.lines);

    const entry = await this.prisma.journalEntry.create({
      data: {
        state: "DRAFT",
        date: input.date,
        narration: input.narration,
        lines: {
          create: input.lines.map((l) => ({
            account: l.account,
            amount: l.amount,
          })),
        },
      },
    });

    return { id: entry.id };
  }
}

// ---------------------------------------------------------------------------
// findJournalEntrySource — standalone reverse-lookup helper (S23b F-15)
// ---------------------------------------------------------------------------

/**
 * Reverse-lookup the operational document that posted a given JournalEntry id,
 * via the LedgerPosting correlation table (sourceType/sourceId → journalEntryId).
 * Best-effort — returns null when no posting references this JE (manual
 * "Penyesuaian" entries are their own source and expected to return null).
 *
 * `href` is app-relative and points at the admin section for that source type;
 * per-doc detail routes can be added as slices land.
 */
export async function findJournalEntrySource(
  prisma: PrismaClient,
  jeId: string,
): Promise<JournalEntrySource | null> {
  const posting = await prisma.ledgerPosting.findFirst({
    where: { journalEntryId: jeId },
    select: { sourceType: true, sourceId: true },
  });
  if (!posting) return null;

  switch (posting.sourceType) {
    case "kasir":
      return {
        type: "kasir",
        sourceId: posting.sourceId,
        label: `Transaksi kasir ${posting.sourceId}`,
        href: `/admin/orders`,
      };
    case "order":
      return {
        type: "order",
        sourceId: posting.sourceId,
        label: `Pesanan ${posting.sourceId}`,
        href: `/admin/orders`,
      };
    case "purchase":
      return {
        type: "purchase",
        sourceId: posting.sourceId,
        label: `Pembelian ${posting.sourceId}`,
        href: `/admin/purchasing`,
      };
    default:
      return null;
  }
}
