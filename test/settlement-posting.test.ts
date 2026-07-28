/**
 * settlement-posting.test.ts — SettlementPostingRepository (online-platform payouts).
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { PrismaClient } from "@/generated/prisma";
import {
  SettlementPostingRepository,
  SettlementImbalanceError,
  InvalidSettlementError,
  SettlementAlreadyPostedError,
  type SettlementSpec,
} from "../lib/accounting/settlementPostingRepository";
import { AccountingRepository, PeriodLockedError } from "../lib/accounting/accountingRepository";
import { createTestClient, resetDb } from "./setup";

let prisma: PrismaClient;
let settlements: SettlementPostingRepository;
let acc: AccountingRepository;

const CASH = "Assets:Cash:Bank";

beforeAll(async () => {
  prisma = await createTestClient();
  settlements = new SettlementPostingRepository(prisma);
  acc = new AccountingRepository(prisma);
});

afterEach(async () => {
  await resetDb(prisma);
});

function spec(overrides: Partial<SettlementSpec> = {}): SettlementSpec {
  return {
    date: "2026-07-01",
    settlementId: "settle-1",
    service: "GoFood",
    totalGross: 1_000_000n,
    commissionAmount: 200_000n,
    deductionsTotal: 50_000n,
    finalAmount: 750_000n,
    cashAccount: CASH,
    ...overrides,
  };
}

describe("postSettlement", () => {
  it("posts a balanced entry with the three expected legs", async () => {
    const posted = await settlements.postSettlement(spec());
    expect(posted.lines).toHaveLength(3);
    expect(posted.lines.reduce((a, l) => a + l.amount, 0n)).toBe(0n);

    const cashLine = posted.lines.find((l) => l.account === CASH);
    expect(cashLine?.amount).toBe(750_000n);
    const komisiLine = posted.lines.find((l) => l.account === "Expenses:OpEx:KomisiOnline");
    expect(komisiLine?.amount).toBe(250_000n);
    const incomeLine = posted.lines.find((l) => l.account === "Income:Sales:Online");
    expect(incomeLine?.amount).toBe(-1_000_000n);

    const book = await acc.loadBook();
    expect(book.balance(CASH)).toBe(750_000n);
    expect(book.balance("Expenses:OpEx:KomisiOnline")).toBe(250_000n);
    expect(book.balance("Income:Sales:Online")).toBe(-1_000_000n);
    expect(book.equationResidual()).toBe(0n);
  });

  it("throws SettlementImbalanceError on mismatch", async () => {
    await expect(
      settlements.postSettlement(spec({ finalAmount: 700_000n })),
    ).rejects.toThrow(SettlementImbalanceError);
  });

  it("omits the expense leg entirely when commission and deductions are both zero", async () => {
    const posted = await settlements.postSettlement(
      spec({ commissionAmount: 0n, deductionsTotal: 0n, finalAmount: 1_000_000n }),
    );
    expect(posted.lines).toHaveLength(2);
    expect(posted.lines.some((l) => l.account === "Expenses:OpEx:KomisiOnline")).toBe(false);
  });

  it("rejects negative input", async () => {
    await expect(
      settlements.postSettlement(spec({ commissionAmount: -1n })),
    ).rejects.toThrow(InvalidSettlementError);
  });

  it("a second post for the same settlementId throws SettlementAlreadyPostedError", async () => {
    await settlements.postSettlement(spec());
    await expect(settlements.postSettlement(spec())).rejects.toThrow(SettlementAlreadyPostedError);
  });

  it("posting into a locked month throws PeriodLockedError", async () => {
    const locked = new SettlementPostingRepository(prisma, {
      lockedUntilProvider: async () => "2026-07-31",
    });
    await expect(locked.postSettlement(spec())).rejects.toThrow(PeriodLockedError);
  });
});

describe("voidSettlement", () => {
  it("reverses the entry, deletes the correlation row, and allows a re-post afterwards", async () => {
    const posted = await settlements.postSettlement(spec());
    await settlements.voidSettlement("settle-1");

    const original = await acc.getEntryById(posted.journalEntryId);
    expect(original?.state).toBe("VOID");

    const row = await settlements.getPostingFor("settle-1");
    expect(row).toBeNull();

    const book = await acc.loadBook();
    expect(book.balance(CASH)).toBe(0n);

    // re-post succeeds
    const reposted = await settlements.postSettlement(spec());
    expect(reposted.journalEntryId).not.toBe(posted.journalEntryId);
    const book2 = await acc.loadBook();
    expect(book2.balance(CASH)).toBe(750_000n);
  });
});
