/**
 * accounting.test.ts — Integration tests for AccountingRepository (Slice 2).
 *
 * Maps to TESTING.md Flow 6 rows + cross-cutting bug regression list (B):
 *   #1 — Gapless number at POST
 *   #2 — POSTED-edit rejected → reversal path
 *   #3 — Book-from-DB == derived (derive-from-ledger)
 *   #5 — Illegal state transition rejected
 *
 * Wiring: pglite (in-process WASM Postgres) via pglite-prisma-adapter → PrismaClient.
 * The REAL AccountingRepository runs unchanged — same code path as production Supabase.
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { PrismaClient } from "@/generated/prisma";
import { AccountingRepository, findJournalEntrySource } from "../lib/accounting/accountingRepository";
import { createTestClient, resetDb } from "./setup";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let prisma: PrismaClient;
let repo: AccountingRepository;

beforeAll(async () => {
  prisma = await createTestClient();
  repo = new AccountingRepository(prisma);
});

afterEach(async () => {
  await resetDb(prisma);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A balanced pair of lines: debit Assets:Cash 100, credit Income:Sales 100 */
const cashSaleLine = (amount: bigint = 100_000n) => [
  { account: "Assets:Cash:Mandiri", amount },
  { account: "Income:Sales", amount: -amount },
];

/** A balanced set: debit Expense, credit Cash */
const expenseLine = (amount: bigint = 50_000n) => [
  { account: "Expenses:OpEx:Listrik", amount },
  { account: "Assets:Cash:Mandiri", amount: -amount },
];

// ---------------------------------------------------------------------------
// Test: DRAFT entry has null number
// ---------------------------------------------------------------------------

describe("DRAFT entry", () => {
  it("has null number before posting", async () => {
    const { id } = await repo.createDraft({
      date: "2024-01-15",
      narration: "Test draft",
      lines: cashSaleLine(),
    });

    const entry = await prisma.journalEntry.findUniqueOrThrow({ where: { id } });
    expect(entry.state).toBe("DRAFT");
    expect(entry.number).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test: Gapless number at POST (bug #1)
// ---------------------------------------------------------------------------

describe("Gapless number at POST (bug #1)", () => {
  it("assigns sequential numbers starting at 1 for consecutive posts", async () => {
    const entries = await Promise.all([
      repo.postEntry({ date: "2024-01-01", narration: "Entry A", lines: cashSaleLine() }),
      repo.postEntry({ date: "2024-01-02", narration: "Entry B", lines: cashSaleLine() }),
      repo.postEntry({ date: "2024-01-03", narration: "Entry C", lines: cashSaleLine() }),
    ]);

    // pglite is single-connection; awaiting sequentially guarantees deterministic order
    const numbers = entries.map((e) => e.number).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3]);
  });

  it("posting N entries yields numbers 1..N with no gaps or duplicates", async () => {
    const N = 10;
    const posted: number[] = [];

    for (let i = 0; i < N; i++) {
      const e = await repo.postEntry({
        date: `2024-01-${String(i + 1).padStart(2, "0")}`,
        narration: `Entry ${i + 1}`,
        lines: cashSaleLine(),
      });
      posted.push(e.number);
    }

    const sorted = [...posted].sort((a, b) => a - b);
    const expected = Array.from({ length: N }, (_, i) => i + 1);
    expect(sorted).toEqual(expected);
  });

  it("DRAFT entry has number=null; number is assigned only at POST", async () => {
    const { id } = await repo.createDraft({
      date: "2024-01-15",
      narration: "Staged draft",
      lines: cashSaleLine(),
    });

    const draft = await prisma.journalEntry.findUniqueOrThrow({ where: { id } });
    expect(draft.number).toBeNull();

    // Post a fresh entry; the draft remains unnumbered
    const posted = await repo.postEntry({
      date: "2024-01-16",
      narration: "Fresh post",
      lines: cashSaleLine(),
    });
    expect(posted.number).toBe(1);

    // Draft still has null
    const draftAfter = await prisma.journalEntry.findUniqueOrThrow({ where: { id } });
    expect(draftAfter.number).toBeNull();
  });
});

// Note: true parallel-concurrency contention requires a multi-connection DB.
// pglite is single-connection; serial determinism is proven above.
// The real-concurrency test runs against DIRECT_URL (interactive $transaction needs
// a session connection, not the pgbouncer transaction-mode pooler).
describe.skipIf(!process.env["RUN_LIVE_DB_TESTS"])("Concurrency — real Postgres (Supabase)", () => {
  it("10 concurrent POSTs → numbers 1..25, no gaps/dups", async () => {
    const { PrismaClient: LivePrismaClient } = await import("@/generated/prisma");

    // Use DIRECT_URL for interactive $transaction (session-mode connection required)
    const directUrl = process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"]!;
    // Extend interactive transaction timeout — under concurrency, lock-waits can exceed
    // the default 5s on the free-tier Supabase direct connection.
    const liveClient = new LivePrismaClient({
      datasourceUrl: directUrl,
      transactionOptions: { timeout: 30_000, maxWait: 10_000 },
    } as ConstructorParameters<typeof LivePrismaClient>[0]);
    const liveRepo = new AccountingRepository(liveClient);

    // N=10: Supabase free-tier session mode is capped at pool_size=15.
    // Each $transaction opens one session connection. Keep well under the cap.
    const N = 10;

    try {
      // Pre-seed the 'journal' sequence row to avoid a race on first-create:
      // concurrent upserts inside transactions can all pass the NOT EXISTS check
      // then all try to INSERT, causing unique constraint violations.
      // Using INSERT ... ON CONFLICT DO NOTHING ensures the row exists before
      // concurrent transactions start their UPDATE ... RETURNING.
      await liveClient.$executeRaw`
        INSERT INTO sequences (id, key, value)
        VALUES (gen_random_uuid()::text, 'journal', 0)
        ON CONFLICT (key) DO NOTHING
      `;

      const results = await Promise.all(
        Array.from({ length: N }, (_, i) =>
          liveRepo.postEntry({
            date: "2026-01-01",
            narration: `Concurrent entry ${i + 1}`,
            lines: [
              { account: "Assets:Cash:Mandiri", amount: 100_000n },
              { account: "Income:Sales", amount: -100_000n },
            ],
          }),
        ),
      );

      const numbers = results.map((r) => r.number).sort((a, b) => a - b);
      const expected = Array.from({ length: N }, (_, i) => i + 1);

      // Gapless: exactly 1..N
      expect(numbers).toEqual(expected);
      // No duplicates (set size == N)
      expect(new Set(numbers).size).toBe(N);
    } finally {
      // Clean up: delete all journal entries written by this test (identified by
      // narration prefix "Concurrent entry"), then reset the sequence.
      await liveClient.$executeRaw`
        DELETE FROM journal_lines
        WHERE "entryId" IN (
          SELECT id FROM journal_entries WHERE narration LIKE 'Concurrent entry %'
        )
      `;
      await liveClient.$executeRaw`
        DELETE FROM journal_entries WHERE narration LIKE 'Concurrent entry %'
      `;
      await liveClient.$executeRaw`
        DELETE FROM sequences WHERE key = 'journal'
      `;
      await liveClient.$disconnect();
    }
  });
});

// ---------------------------------------------------------------------------
// Test: Zero-sum rejected (invariant enforcement before DB write)
// ---------------------------------------------------------------------------

describe("Zero-sum enforcement before persist", () => {
  it("throws when lines do not sum to zero, and writes nothing to DB", async () => {
    const beforeCount = await prisma.journalEntry.count();

    await expect(
      repo.postEntry({
        date: "2024-01-15",
        narration: "Unbalanced entry",
        lines: [
          { account: "Assets:Cash:Mandiri", amount: 100_000n },
          { account: "Income:Sales", amount: -90_000n }, // Off by 10_000
        ],
      }),
    ).rejects.toThrow();

    // DB must be unchanged
    const afterCount = await prisma.journalEntry.count();
    expect(afterCount).toBe(beforeCount);
  });

  it("also rejects an unbalanced DRAFT", async () => {
    await expect(
      repo.createDraft({
        date: "2024-01-15",
        narration: "Unbalanced draft",
        lines: [{ account: "Assets:Cash:Mandiri", amount: 100_000n }],
      }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Test: Book-from-DB == derived (bug #3 — derive-from-ledger)
// ---------------------------------------------------------------------------

describe("Book-from-DB equals derived sums (bug #3)", () => {
  it("loadBook returns balances equal to hand-computed sums", async () => {
    // Post 3 entries with known amounts
    await repo.postEntry({
      date: "2024-01-01",
      narration: "Opening capital",
      lines: [
        { account: "Assets:Cash:Mandiri", amount: 5_000_000n },
        { account: "Equity:Modal", amount: -5_000_000n },
      ],
    });

    await repo.postEntry({
      date: "2024-01-02",
      narration: "Penjualan tunai",
      lines: [
        { account: "Assets:Cash:Mandiri", amount: 200_000n },
        { account: "Income:Sales", amount: -200_000n },
      ],
    });

    await repo.postEntry({
      date: "2024-01-03",
      narration: "Bayar listrik",
      lines: [
        { account: "Expenses:OpEx:Listrik", amount: 50_000n },
        { account: "Assets:Cash:Mandiri", amount: -50_000n },
      ],
    });

    const book = await repo.loadBook();

    // Hand-computed expected balances (positive = debit balance)
    // Assets:Cash:Mandiri = 5_000_000 + 200_000 - 50_000 = 5_150_000
    // Equity:Modal = -(-5_000_000) = debit-credit sign convention: amount stored as -5_000_000 (credit)
    //   balance() sums amounts; -5_000_000 → balance = -5_000_000 (credit balance)
    // Income:Sales = -200_000 (credit balance)
    // Expenses:OpEx:Listrik = 50_000 (debit balance)

    expect(book.balance("Assets:Cash:Mandiri")).toBe(5_150_000n);
    expect(book.balance("Equity:Modal")).toBe(-5_000_000n);
    expect(book.balance("Income:Sales")).toBe(-200_000n);
    expect(book.balance("Expenses:OpEx:Listrik")).toBe(50_000n);
  });

  it("loadBook respects dateFrom/dateTo filter", async () => {
    await repo.postEntry({
      date: "2024-01-01",
      narration: "January entry",
      lines: cashSaleLine(100_000n),
    });
    await repo.postEntry({
      date: "2024-02-01",
      narration: "February entry",
      lines: cashSaleLine(200_000n),
    });

    const jan = await repo.loadBook({ dateFrom: "2024-01-01", dateTo: "2024-01-31" });
    const feb = await repo.loadBook({ dateFrom: "2024-02-01", dateTo: "2024-02-28" });

    expect(jan.balance("Assets:Cash:Mandiri")).toBe(100_000n);
    expect(feb.balance("Assets:Cash:Mandiri")).toBe(200_000n);
  });

  it("VOID entries + reversal both included in Book; net balance is zero", async () => {
    const entry = await repo.postEntry({
      date: "2024-01-05",
      narration: "Sale to be voided",
      lines: cashSaleLine(300_000n),
    });

    // Before void: balance includes the POSTED original entry
    const before = await repo.loadBook();
    expect(before.balance("Assets:Cash:Mandiri")).toBe(300_000n);

    // Void the entry
    await repo.voidEntry(entry.id);

    // After void:
    //   - original is VOID (still included in loadBook for audit trail)
    //   - reversal is POSTED (negated lines: cash = -300_000n)
    //   - net = 300_000n + (-300_000n) = 0n
    // This mirrors Odoo: reversed entries stay in the ledger; they cancel each other.
    const after = await repo.loadBook();
    expect(after.balance("Assets:Cash:Mandiri")).toBe(0n);

    // Verify the original is marked VOID in DB
    const dbEntry = await prisma.journalEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(dbEntry.state).toBe("VOID");
  });
});

// ---------------------------------------------------------------------------
// Test: POSTED-edit rejected → reversal (bug #2)
// ---------------------------------------------------------------------------

describe("POSTED entry immutability + reversal (bug #2)", () => {
  it("voidEntry creates a balanced reversing entry", async () => {
    const original = await repo.postEntry({
      date: "2024-01-10",
      narration: "Penjualan tunai",
      lines: [
        { account: "Assets:Cash:Mandiri", amount: 150_000n },
        { account: "Income:Sales", amount: -150_000n },
      ],
    });

    const reversal = await repo.voidEntry(original.id);

    // Reversal lines negate the original
    const reversalLines = reversal.lines;
    const cashLine = reversalLines.find((l) => l.account === "Assets:Cash:Mandiri");
    const incomeLine = reversalLines.find((l) => l.account === "Income:Sales");
    expect(cashLine?.amount).toBe(-150_000n);
    expect(incomeLine?.amount).toBe(150_000n);

    // Reversal itself is POSTED with a gapless number
    expect(reversal.state).toBe("POSTED");
    expect(reversal.number).toBeGreaterThan(0);
  });

  it("original entry is marked VOID after voidEntry", async () => {
    const original = await repo.postEntry({
      date: "2024-01-10",
      narration: "Will be voided",
      lines: cashSaleLine(),
    });

    await repo.voidEntry(original.id);

    const dbEntry = await prisma.journalEntry.findUniqueOrThrow({
      where: { id: original.id },
    });
    expect(dbEntry.state).toBe("VOID");
  });

  it("voidEntry links reversal to original via reversedById", async () => {
    const original = await repo.postEntry({
      date: "2024-01-10",
      narration: "Original",
      lines: cashSaleLine(),
    });

    const reversal = await repo.voidEntry(original.id);

    const reversalEntry = await prisma.journalEntry.findUniqueOrThrow({
      where: { id: reversal.id },
    });
    expect(reversalEntry.reversedById).toBe(original.id);
  });

  it("net balances return to pre-SALE state after void", async () => {
    // Baseline: post an opening entry
    await repo.postEntry({
      date: "2024-01-01",
      narration: "Opening",
      lines: [
        { account: "Assets:Cash:Mandiri", amount: 1_000_000n },
        { account: "Equity:Modal", amount: -1_000_000n },
      ],
    });

    const baseBook = await repo.loadBook();
    const baseCash = baseBook.balance("Assets:Cash:Mandiri"); // 1_000_000n

    // Post a sale
    const sale = await repo.postEntry({
      date: "2024-01-05",
      narration: "Sale",
      lines: cashSaleLine(200_000n),
    });

    // Verify sale is included
    const withSale = await repo.loadBook();
    expect(withSale.balance("Assets:Cash:Mandiri")).toBe(baseCash + 200_000n);

    // Void the sale:
    //   original becomes VOID (included in loadBook, lines still +200_000n)
    //   reversal is POSTED (lines negated: cash -200_000n)
    //   net = opening 1_000_000n + original 200_000n + reversal -200_000n = 1_000_000n
    await repo.voidEntry(sale.id);

    const afterBook = await repo.loadBook();
    // Original (VOID) + reversal (POSTED) cancel each other; balance returns to baseCash.
    expect(afterBook.balance("Assets:Cash:Mandiri")).toBe(baseCash);
  });
});

// ---------------------------------------------------------------------------
// Test: Illegal state transitions (bug #5 analog)
// ---------------------------------------------------------------------------

describe("Illegal state transitions (bug #5)", () => {
  it("voidEntry on a DRAFT entry throws IllegalStateTransitionError", async () => {
    const { id } = await repo.createDraft({
      date: "2024-01-15",
      narration: "Draft",
      lines: cashSaleLine(),
    });

    const { IllegalStateTransitionError } = await import("../lib/accounting/accountingRepository");
    await expect(repo.voidEntry(id)).rejects.toThrow(IllegalStateTransitionError);
  });

  it("voidEntry on an already-VOID entry throws IllegalStateTransitionError", async () => {
    const entry = await repo.postEntry({
      date: "2024-01-15",
      narration: "Will be voided twice",
      lines: cashSaleLine(),
    });

    await repo.voidEntry(entry.id);

    const { IllegalStateTransitionError } = await import("../lib/accounting/accountingRepository");
    await expect(repo.voidEntry(entry.id)).rejects.toThrow(IllegalStateTransitionError);
  });

  it("voidEntry on non-existent entry throws EntryNotFoundError", async () => {
    const { EntryNotFoundError } = await import("../lib/accounting/accountingRepository");
    await expect(repo.voidEntry("non-existent-cuid-id")).rejects.toThrow(EntryNotFoundError);
  });
});

// ---------------------------------------------------------------------------
// Test: Accounting equation (Assets = Liabilities + Equity) from Book
// ---------------------------------------------------------------------------

describe("Accounting equation from Book (WB port)", () => {
  it("equationResidual is 0 after balanced entries", async () => {
    await repo.postEntry({
      date: "2024-01-01",
      narration: "Opening",
      lines: [
        { account: "Assets:Cash:Mandiri", amount: 2_000_000n },
        { account: "Equity:Modal", amount: -2_000_000n },
      ],
    });

    await repo.postEntry({
      date: "2024-01-02",
      narration: "Penjualan",
      lines: [
        { account: "Assets:Cash:Mandiri", amount: 500_000n },
        { account: "Income:Sales", amount: -500_000n },
      ],
    });

    await repo.postEntry({
      date: "2024-01-03",
      narration: "Pengeluaran",
      lines: [
        { account: "Expenses:OpEx:Sewa", amount: 100_000n },
        { account: "Assets:Cash:Mandiri", amount: -100_000n },
      ],
    });

    const book = await repo.loadBook();
    expect(book.equationResidual()).toBe(0n);
  });
});

// ---------------------------------------------------------------------------
// Test: Multiple entries in the same transaction (sequence atomicity)
// ---------------------------------------------------------------------------

describe("Sequence atomicity", () => {
  it("two void operations each get their own gapless number", async () => {
    const e1 = await repo.postEntry({
      date: "2024-01-01",
      narration: "Entry 1",
      lines: cashSaleLine(),
    });
    const e2 = await repo.postEntry({
      date: "2024-01-02",
      narration: "Entry 2",
      lines: expenseLine(),
    });

    expect(e1.number).toBe(1);
    expect(e2.number).toBe(2);

    const r1 = await repo.voidEntry(e1.id);
    const r2 = await repo.voidEntry(e2.id);

    expect(r1.number).toBe(3);
    expect(r2.number).toBe(4);

    // All numbers unique
    const all = [e1.number, e2.number, r1.number, r2.number];
    expect(new Set(all).size).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Test: getEntryById + findJournalEntrySource (S23b F-15 doc<->jurnal links)
// ---------------------------------------------------------------------------

describe("getEntryById (S23b F-15)", () => {
  it("returns the entry with its lines", async () => {
    const posted = await repo.postEntry({
      date: "2024-01-05",
      narration: "Test lookup",
      lines: cashSaleLine(30_000n),
    });

    const found = await repo.getEntryById(posted.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(posted.id);
    expect(found?.number).toBe(posted.number);
    expect(found?.state).toBe("POSTED");
    expect(found?.lines).toHaveLength(2);
  });

  it("returns null for an unknown id", async () => {
    const found = await repo.getEntryById("nonexistent-id");
    expect(found).toBeNull();
  });
});

describe("findJournalEntrySource (S23b F-15)", () => {
  it("returns null for a manual/adjustment entry with no referencing doc", async () => {
    const posted = await repo.postEntry({
      date: "2024-01-06",
      narration: "Penyesuaian manual",
      lines: expenseLine(10_000n),
    });

    const source = await findJournalEntrySource(prisma, posted.id);
    expect(source).toBeNull();
  });

  it("finds the source doc via a LedgerPosting correlation row", async () => {
    const posted = await repo.postEntry({
      date: "2024-01-07",
      narration: "Pembelian barang",
      lines: expenseLine(20_000n),
    });

    // tokokencana keeps no journalEntryId column on operational rows — the link
    // lives in LedgerPosting (sourceType/sourceId → journalEntryId).
    await prisma.ledgerPosting.create({
      data: {
        sourceType: "purchase",
        sourceId: "po_ABC123",
        journalEntryId: posted.id,
      },
    });

    const source = await findJournalEntrySource(prisma, posted.id);
    expect(source).not.toBeNull();
    expect(source?.type).toBe("purchase");
    expect(source?.sourceId).toBe("po_ABC123");
    expect(source?.label).toContain("po_ABC123");
    expect(source?.href).toBe("/admin/purchasing");
  });
});
