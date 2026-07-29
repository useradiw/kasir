/**
 * month-lock.test.ts — MonthRepository.lock/unlock wired to the real
 * AccountingRepository lock boundary (monthLockOptions), Slice 5.
 *
 * monthLockOptions() resolves the boundary EAGERLY at construction time (see
 * the doc comment in lib/accounting/monthLock.ts — required so pglite's
 * single connection never sees a query issued from outside an open
 * transaction). Every test that changes lock state therefore constructs a
 * FRESH AccountingRepository afterwards, exactly as test/sales-posting.test.ts
 * / test/statements.test.ts do for their lock cases.
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { PrismaClient } from "@/generated/prisma";
import {
  AccountingRepository,
  PeriodLockedError,
} from "../lib/accounting/accountingRepository";
import { monthLockOptions } from "../lib/accounting/monthLock";
import { MonthRepository, MonthNotFoundError } from "../lib/accounting/monthRepository";
import { createTestClient, resetDb } from "./setup";

let prisma: PrismaClient;
let months: MonthRepository;

const UTAMA = "Assets:Cash:Utama";

beforeAll(async () => {
  prisma = await createTestClient();
  months = new MonthRepository(prisma);
});

afterEach(async () => {
  await resetDb(prisma);
});

function freshAcc(): AccountingRepository {
  return new AccountingRepository(prisma, monthLockOptions(prisma));
}

describe("month lock boundary", () => {
  it("posting an entry dated inside a locked month throws PeriodLockedError; after unlock, the same post succeeds", async () => {
    await months.create("2026-07");
    await months.lock("2026-07");

    const lockedAcc = freshAcc();
    await expect(
      lockedAcc.postEntry({
        date: "2026-07-15",
        narration: "Sale",
        lines: [{ account: UTAMA, amount: 100_000n }, { account: "Income:Sales:Tunai", amount: -100_000n }],
      }),
    ).rejects.toThrow(PeriodLockedError);

    await months.unlock("2026-07");
    const unlockedAcc = freshAcc();
    const posted = await unlockedAcc.postEntry({
      date: "2026-07-15",
      narration: "Sale",
      lines: [{ account: UTAMA, amount: 100_000n }, { account: "Income:Sales:Tunai", amount: -100_000n }],
    });
    expect(posted.state).toBe("POSTED");
  });

  it("voiding an entry inside a locked month is also rejected", async () => {
    // Post BEFORE locking, with an unlocked repository.
    const unlockedAcc = freshAcc();
    const posted = await unlockedAcc.postEntry({
      date: "2026-07-10",
      narration: "Sale",
      lines: [{ account: UTAMA, amount: 50_000n }, { account: "Income:Sales:Tunai", amount: -50_000n }],
    });

    await months.create("2026-07");
    await months.lock("2026-07");
    const lockedAcc = freshAcc();
    await expect(lockedAcc.voidEntry(posted.id)).rejects.toThrow(PeriodLockedError);
  });

  it("an entry dated AFTER the boundary posts normally while an earlier month is locked", async () => {
    await months.create("2026-07");
    await months.lock("2026-07");

    const acc = freshAcc();
    const posted = await acc.postEntry({
      date: "2026-08-01",
      narration: "Sale",
      lines: [{ account: UTAMA, amount: 100_000n }, { account: "Income:Sales:Tunai", amount: -100_000n }],
    });
    expect(posted.state).toBe("POSTED");
  });

  it("lock() on a nonexistent month throws MonthNotFoundError", async () => {
    await expect(months.lock("2026-09")).rejects.toThrow(MonthNotFoundError);
  });

  it("lock/unlock are idempotent", async () => {
    await months.create("2026-07");
    const lock1 = await months.lock("2026-07");
    const lock2 = await months.lock("2026-07");
    expect(lock1.locked).toBe(true);
    expect(lock2.locked).toBe(true);

    const unlock1 = await months.unlock("2026-07");
    const unlock2 = await months.unlock("2026-07");
    expect(unlock1.locked).toBe(false);
    expect(unlock2.locked).toBe(false);
  });
});
