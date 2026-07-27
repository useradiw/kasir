/**
 * cash-accounts.test.ts — CashAccountRepository (freely-creatable kas accounts).
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { PrismaClient } from "@/generated/prisma";
import { CashAccountRepository, InvalidCashAccountError } from "../lib/accounting/cashAccountRepository";
import { createTestClient, resetDb } from "./setup";

let prisma: PrismaClient;
let repo: CashAccountRepository;

beforeAll(async () => {
  prisma = await createTestClient();
  repo = new CashAccountRepository(prisma);
});

afterEach(async () => {
  await resetDb(prisma);
});

describe("create", () => {
  it("derives a Beancount name + label from a friendly name", async () => {
    const acc = await repo.create("Bank BCA");
    expect(acc.name).toBe("Assets:Cash:BankBCA");
    expect(acc.label).toBe("Bank BCA");
    expect(acc.code).toBe("cash-bank-bca");
    expect(acc.active).toBe(true);
  });

  it("suffixes on name collision instead of failing", async () => {
    const a = await repo.create("Kas Laci");
    const b = await repo.create("Kas Laci");
    expect(a.name).toBe("Assets:Cash:KasLaci");
    expect(b.name).toBe("Assets:Cash:KasLaci2");
  });

  it("rejects an empty name", async () => {
    await expect(repo.create("   ")).rejects.toThrow(InvalidCashAccountError);
  });
});

describe("list", () => {
  it("returns active accounts by default, all when asked", async () => {
    const a = await repo.create("Kas Laci");
    await repo.create("Bank BCA");
    await repo.setActive(a.id, false);

    const active = await repo.list();
    expect(active.map((r) => r.label)).toEqual(["Bank BCA"]);

    const all = await repo.list(true);
    expect(all).toHaveLength(2);
  });
});

describe("rename", () => {
  it("changes the display label but never the Beancount name", async () => {
    const acc = await repo.create("Bank BCA");
    const renamed = await repo.rename(acc.id, "Bank Central Asia");
    expect(renamed.label).toBe("Bank Central Asia");
    expect(renamed.name).toBe("Assets:Cash:BankBCA"); // unchanged — ledger history intact
  });
});
