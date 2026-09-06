/**
 * chart-of-accounts.test.ts — seed the kasir COA into the LedgerAccount
 * registry and prove idempotency + correct type mapping.
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { PrismaClient } from "@/generated/prisma";
import {
  seedChartOfAccounts,
  accountTypeFor,
  KASIR_CHART_OF_ACCOUNTS,
} from "../lib/accounting/chart-of-accounts";
import { createTestClient, resetDb } from "./setup";

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestClient();
});

afterEach(async () => {
  await resetDb(prisma);
});

describe("accountTypeFor", () => {
  it("maps Beancount roots to AccountType", () => {
    expect(accountTypeFor("Assets:Cash:Utama")).toBe("ASSET");
    expect(accountTypeFor("Income:Sales:Tunai")).toBe("INCOME");
    expect(accountTypeFor("Expenses:BahanBaku:Bahan")).toBe("EXPENSE");
    expect(accountTypeFor("Equity:Modal")).toBe("EQUITY");
  });

  it("throws on an unknown root", () => {
    expect(() => accountTypeFor("Nonsense:Foo")).toThrow();
  });
});

describe("seedChartOfAccounts", () => {
  it("seeds every account with the right type", async () => {
    await seedChartOfAccounts(prisma);

    const count = await prisma.ledgerAccount.count();
    expect(count).toBe(KASIR_CHART_OF_ACCOUNTS.length);

    const tunai = await prisma.ledgerAccount.findUnique({ where: { code: "sales-tunai" } });
    expect(tunai?.name).toBe("Income:Sales:Tunai");
    expect(tunai?.type).toBe("INCOME");
    expect(tunai?.active).toBe(true);

    const bahanBaku = await prisma.ledgerAccount.findUnique({ where: { code: "bahan-baku" } });
    expect(bahanBaku?.name).toBe("Expenses:BahanBaku:Bahan");
    expect(bahanBaku?.type).toBe("EXPENSE");

    const selisihExpense = await prisma.ledgerAccount.findUnique({
      where: { code: "selisih-kas-expense" },
    });
    expect(selisihExpense?.name).toBe("Expenses:SelisihKas");
    expect(selisihExpense?.type).toBe("EXPENSE");

    const selisihIncome = await prisma.ledgerAccount.findUnique({
      where: { code: "selisih-kas-income" },
    });
    expect(selisihIncome?.name).toBe("Income:SelisihKas");
    expect(selisihIncome?.type).toBe("INCOME");
  });

  it("is idempotent — running twice does not duplicate", async () => {
    await seedChartOfAccounts(prisma);
    await seedChartOfAccounts(prisma);

    const count = await prisma.ledgerAccount.count();
    expect(count).toBe(KASIR_CHART_OF_ACCOUNTS.length);
  });
});
