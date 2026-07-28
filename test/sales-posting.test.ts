/**
 * sales-posting.test.ts — SalesPostingRepository (one JE per closed kasir day).
 * DayCloseSpec is an already-computed plain input — this repo never queries
 * Transaction/CashRegister (those tables don't exist in the pglite test DB).
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { PrismaClient } from "@/generated/prisma";
import {
  SalesPostingRepository,
  DayCloseAlreadyPostedError,
  type DayCloseSpec,
} from "../lib/accounting/salesPostingRepository";
import { AccountingRepository, PeriodLockedError } from "../lib/accounting/accountingRepository";
import { createTestClient, resetDb } from "./setup";

let prisma: PrismaClient;
let sales: SalesPostingRepository;
let acc: AccountingRepository;

const TUNAI = "Assets:Cash:Laci";
const ELEKTRONIK = "Assets:Cash:Bank";

beforeAll(async () => {
  prisma = await createTestClient();
  sales = new SalesPostingRepository(prisma);
  acc = new AccountingRepository(prisma);
});

afterEach(async () => {
  await resetDb(prisma);
});

function spec(overrides: Partial<DayCloseSpec> = {}): DayCloseSpec {
  return {
    date: "2026-07-01",
    cashRegisterId: "reg-1",
    cashSales: 0n,
    qrisSales: 0n,
    expectedCash: 0n,
    countedCash: 0n,
    tunaiAccount: TUNAI,
    elektronikAccount: ELEKTRONIK,
    ...overrides,
  };
}

describe("postDayClose", () => {
  it("posts cash-only sales", async () => {
    const posted = await sales.postDayClose(
      spec({ cashSales: 500_000n, expectedCash: 500_000n, countedCash: 500_000n }),
    );
    expect(posted).not.toBeNull();
    const book = await acc.loadBook();
    expect(book.balance(TUNAI)).toBe(500_000n);
    expect(book.balance("Income:Sales:Tunai")).toBe(-500_000n);
    expect(book.equationResidual()).toBe(0n);
  });

  it("posts qris-only sales", async () => {
    await sales.postDayClose(spec({ qrisSales: 200_000n }));
    const book = await acc.loadBook();
    expect(book.balance(ELEKTRONIK)).toBe(200_000n);
    expect(book.balance("Income:Sales:QRIS")).toBe(-200_000n);
  });

  it("posts both cash and qris", async () => {
    await sales.postDayClose(
      spec({ cashSales: 500_000n, qrisSales: 200_000n, expectedCash: 500_000n, countedCash: 500_000n }),
    );
    const book = await acc.loadBook();
    expect(book.balance(TUNAI)).toBe(500_000n);
    expect(book.balance(ELEKTRONIK)).toBe(200_000n);
    expect(book.balance("Income:Sales:Tunai")).toBe(-500_000n);
    expect(book.balance("Income:Sales:QRIS")).toBe(-200_000n);
    expect(book.equationResidual()).toBe(0n);
  });

  it("shortage posts Expenses:SelisihKas with the shortfall amount", async () => {
    // cash 500_000, expected 450_000, counted 440_000 -> selisih = -10_000
    const posted = await sales.postDayClose(
      spec({ cashSales: 500_000n, qrisSales: 200_000n, expectedCash: 450_000n, countedCash: 440_000n }),
    );
    expect(posted).not.toBeNull();
    const line = posted!.lines.find((l) => l.account === "Expenses:SelisihKas");
    expect(line?.amount).toBe(10_000n);
    const tunaiLine = posted!.lines.filter((l) => l.account === TUNAI);
    // cashSales leg (+500_000) plus selisih leg (-10_000)
    expect(tunaiLine.reduce((a, l) => a + l.amount, 0n)).toBe(490_000n);
    expect(
      posted!.lines.reduce((a, l) => a + l.amount, 0n),
    ).toBe(0n);

    const book = await acc.loadBook();
    expect(book.balance("Expenses:SelisihKas")).toBe(10_000n);
  });

  it("overage posts Income:SelisihKas with the surplus amount", async () => {
    const posted = await sales.postDayClose(
      spec({ cashSales: 500_000n, expectedCash: 500_000n, countedCash: 510_000n }),
    );
    const line = posted!.lines.find((l) => l.account === "Income:SelisihKas");
    expect(line?.amount).toBe(-10_000n);
    const book = await acc.loadBook();
    expect(book.balance("Income:SelisihKas")).toBe(-10_000n);
    expect(book.balance(TUNAI)).toBe(510_000n);
  });

  it("exact count posts no selisih leg", async () => {
    const posted = await sales.postDayClose(
      spec({ cashSales: 500_000n, expectedCash: 500_000n, countedCash: 500_000n }),
    );
    const selisihLines = posted!.lines.filter((l) => l.account.startsWith("Expenses:SelisihKas") || l.account.startsWith("Income:SelisihKas"));
    expect(selisihLines).toHaveLength(0);
  });

  it("all-zero returns null and writes nothing", async () => {
    const posted = await sales.postDayClose(spec());
    expect(posted).toBeNull();

    const entries = await prisma.journalEntry.count();
    expect(entries).toBe(0);
    const postings = await prisma.ledgerPosting.count();
    expect(postings).toBe(0);
  });

  it("creates a LedgerPosting row with sourceType/sourceId", async () => {
    const posted = await sales.postDayClose(spec({ cashSales: 100_000n, expectedCash: 100_000n, countedCash: 100_000n }));
    const row = await sales.getPostingFor("reg-1");
    expect(row?.journalEntryId).toBe(posted!.journalEntryId);

    const raw = await prisma.ledgerPosting.findFirst({ where: { sourceId: "reg-1" } });
    expect(raw?.sourceType).toBe("shift-close");
  });

  it("a second post for the same cashRegisterId throws DayCloseAlreadyPostedError", async () => {
    await sales.postDayClose(spec({ cashSales: 100_000n, expectedCash: 100_000n, countedCash: 100_000n }));
    await expect(
      sales.postDayClose(spec({ cashSales: 200_000n, expectedCash: 200_000n, countedCash: 200_000n })),
    ).rejects.toThrow(DayCloseAlreadyPostedError);
  });

  it("posting into a locked month throws PeriodLockedError", async () => {
    const locked = new SalesPostingRepository(prisma, {
      lockedUntilProvider: async () => "2026-07-31",
    });
    await expect(
      locked.postDayClose(spec({ cashSales: 100_000n, expectedCash: 100_000n, countedCash: 100_000n })),
    ).rejects.toThrow(PeriodLockedError);
  });
});

describe("repostDayClose", () => {
  it("voids the old entry, posts a new one, and leaves exactly one LedgerPosting row pointing at the new entry", async () => {
    const first = await sales.postDayClose(
      spec({ cashSales: 500_000n, expectedCash: 500_000n, countedCash: 500_000n }),
    );
    const second = await sales.repostDayClose(
      spec({ cashSales: 300_000n, expectedCash: 300_000n, countedCash: 300_000n }),
    );

    expect(second!.journalEntryId).not.toBe(first!.journalEntryId);

    const oldEntry = await acc.getEntryById(first!.journalEntryId);
    expect(oldEntry?.state).toBe("VOID");

    const newEntry = await acc.getEntryById(second!.journalEntryId);
    expect(newEntry?.state).toBe("POSTED");

    const postings = await prisma.ledgerPosting.findMany({ where: { sourceId: "reg-1" } });
    expect(postings).toHaveLength(1);
    expect(postings[0]!.journalEntryId).toBe(second!.journalEntryId);

    const book = await acc.loadBook();
    expect(book.balance(TUNAI)).toBe(300_000n);
    expect(book.balance("Income:Sales:Tunai")).toBe(-300_000n);
  });

  it("behaves like postDayClose when no posting exists yet", async () => {
    const posted = await sales.repostDayClose(
      spec({ cashSales: 100_000n, expectedCash: 100_000n, countedCash: 100_000n }),
    );
    expect(posted).not.toBeNull();
    const postings = await prisma.ledgerPosting.count();
    expect(postings).toBe(1);
  });
});

describe("voidDayClose", () => {
  it("reverses the entry and removes the correlation row", async () => {
    const posted = await sales.postDayClose(
      spec({ cashSales: 500_000n, expectedCash: 500_000n, countedCash: 500_000n }),
    );
    await sales.voidDayClose("reg-1");

    const original = await acc.getEntryById(posted!.journalEntryId);
    expect(original?.state).toBe("VOID");

    const row = await sales.getPostingFor("reg-1");
    expect(row).toBeNull();

    const book = await acc.loadBook();
    expect(book.balance(TUNAI)).toBe(0n);
  });
});
