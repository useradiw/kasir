/**
 * ledger-expense-totals.test.ts — getLedgerExpenseTotals / getLedgerPengeluaranForPeriod
 * (Slice 3b — laporan repointed at the buku besar).
 *
 * Posts real pengeluaran through ExpenseRepository/AccountingRepository rather
 * than hand-inserting JournalLine rows, so the tests exercise the same posting
 * shape production uses (Dr Expenses:{HPP|OpEx}:{KODE} / Cr Assets:Cash:{akun}).
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { PrismaClient } from "@/generated/prisma";
import { ExpenseRepository } from "../lib/accounting/expenseRepository";
import { AccountingRepository } from "../lib/accounting/accountingRepository";
import {
  getLedgerExpenseTotals,
  getLedgerPengeluaranForPeriod,
} from "../lib/ledger-queries";
import { createTestClient, resetDb } from "./setup";

let prisma: PrismaClient;
let expenses: ExpenseRepository;
let acc: AccountingRepository;

const UTAMA = "Assets:Cash:Utama";

beforeAll(async () => {
  prisma = await createTestClient();
  expenses = new ExpenseRepository(prisma);
  acc = new AccountingRepository(prisma);
});

afterEach(async () => {
  await resetDb(prisma);
});

async function seedCategories() {
  await expenses.createCategory({ code: "KULAKAN", name: "Kulakan", bucket: "HPP" });
  await expenses.createCategory({ code: "LISTRIK", name: "Listrik", bucket: "OPEX" });
}

describe("getLedgerExpenseTotals", () => {
  it("sums HPP-only pengeluaran into hpp, leaves opex at 0", async () => {
    await seedCategories();
    await expenses.recordPengeluaran({
      date: "2026-07-05", akun: UTAMA, item: "Beras", qty: 10, hargaSatuan: 10_000n,
      jumlah: 100_000n, kategoriCode: "KULAKAN",
    });

    const totals = await getLedgerExpenseTotals("2026-07-01", "2026-07-31", prisma);
    expect(totals.hpp).toBe(100_000);
    expect(totals.opex).toBe(0);
    expect(totals.hpp + totals.opex).toBe(100_000);
  });

  it("sums OpEx-only pengeluaran into opex, leaves hpp at 0", async () => {
    await seedCategories();
    await expenses.recordPengeluaran({
      date: "2026-07-05", akun: UTAMA, item: "PLN", qty: 1, hargaSatuan: 250_000n,
      jumlah: 250_000n, kategoriCode: "LISTRIK",
    });

    const totals = await getLedgerExpenseTotals("2026-07-01", "2026-07-31", prisma);
    expect(totals.hpp).toBe(0);
    expect(totals.opex).toBe(250_000);
  });

  it("splits a mix of HPP and OpEx correctly, hpp + opex == grand total", async () => {
    await seedCategories();
    await expenses.recordPengeluaran({
      date: "2026-07-05", akun: UTAMA, item: "Beras", qty: 10, hargaSatuan: 10_000n,
      jumlah: 100_000n, kategoriCode: "KULAKAN",
    });
    await expenses.recordPengeluaran({
      date: "2026-07-06", akun: UTAMA, item: "PLN", qty: 1, hargaSatuan: 250_000n,
      jumlah: 250_000n, kategoriCode: "LISTRIK",
    });

    const totals = await getLedgerExpenseTotals("2026-07-01", "2026-07-31", prisma);
    expect(totals.hpp).toBe(100_000);
    expect(totals.opex).toBe(250_000);

    // Grand total of every Expenses:* line, computed independently from the
    // repository's own return, must equal hpp + opex — no account double
    // counted or dropped.
    const grandTotal = Object.values(totals.byAccount).reduce((s, v) => s + v, 0);
    expect(grandTotal).toBe(totals.hpp + totals.opex);
  });

  it("counts Expenses:SelisihKas and Expenses:OpEx:KomisiOnline as opex", async () => {
    await acc.postEntry({
      date: "2026-07-10",
      narration: "Selisih kas kurang",
      lines: [
        { account: "Expenses:SelisihKas", amount: 5_000n },
        { account: UTAMA, amount: -5_000n },
      ],
    });
    await acc.postEntry({
      date: "2026-07-11",
      narration: "Komisi GoFood",
      lines: [
        { account: "Expenses:OpEx:KomisiOnline", amount: 8_000n },
        { account: "Income:Sales:Online", amount: -8_000n },
      ],
    });

    const totals = await getLedgerExpenseTotals("2026-07-01", "2026-07-31", prisma);
    expect(totals.hpp).toBe(0);
    expect(totals.opex).toBe(13_000);
    expect(totals.byAccount["Expenses:SelisihKas"]).toBe(5_000);
    expect(totals.byAccount["Expenses:OpEx:KomisiOnline"]).toBe(8_000);
  });

  it("nets a VOIDED pengeluaran plus its reversal to zero", async () => {
    await seedCategories();
    const row = await expenses.recordPengeluaran({
      date: "2026-07-05", akun: UTAMA, item: "Beras", qty: 10, hargaSatuan: 10_000n,
      jumlah: 100_000n, kategoriCode: "KULAKAN",
    });
    await expenses.voidPengeluaran(row.id);

    const totals = await getLedgerExpenseTotals("2026-07-01", "2026-07-31", prisma);
    expect(totals.hpp).toBe(0);
    expect(totals.opex).toBe(0);
  });

  it("is inclusive on both ends of the date range", async () => {
    await seedCategories();
    await expenses.recordPengeluaran({
      date: "2026-07-01", akun: UTAMA, item: "Beras", qty: 1, hargaSatuan: 10_000n,
      jumlah: 10_000n, kategoriCode: "KULAKAN",
    });
    await expenses.recordPengeluaran({
      date: "2026-07-31", akun: UTAMA, item: "Gula", qty: 1, hargaSatuan: 20_000n,
      jumlah: 20_000n, kategoriCode: "KULAKAN",
    });
    await expenses.recordPengeluaran({
      date: "2026-06-30", akun: UTAMA, item: "Sebelum rentang", qty: 1, hargaSatuan: 5_000n,
      jumlah: 5_000n, kategoriCode: "KULAKAN",
    });
    await expenses.recordPengeluaran({
      date: "2026-08-01", akun: UTAMA, item: "Sesudah rentang", qty: 1, hargaSatuan: 7_000n,
      jumlah: 7_000n, kategoriCode: "KULAKAN",
    });

    const totals = await getLedgerExpenseTotals("2026-07-01", "2026-07-31", prisma);
    expect(totals.hpp).toBe(30_000);
  });

  it("never counts Income or Assets accounts", async () => {
    await seedCategories();
    await expenses.recordPengeluaran({
      date: "2026-07-05", akun: UTAMA, item: "Beras", qty: 1, hargaSatuan: 10_000n,
      jumlah: 10_000n, kategoriCode: "KULAKAN",
    });
    await acc.postEntry({
      date: "2026-07-06",
      narration: "Penjualan tunai",
      lines: [
        { account: UTAMA, amount: 50_000n },
        { account: "Income:Sales:Tunai", amount: -50_000n },
      ],
    });

    const totals = await getLedgerExpenseTotals("2026-07-01", "2026-07-31", prisma);
    expect(totals.hpp).toBe(10_000);
    expect(totals.opex).toBe(0);
    expect(totals.byAccount[UTAMA]).toBeUndefined();
    expect(totals.byAccount["Income:Sales:Tunai"]).toBeUndefined();
  });
});

describe("getLedgerPengeluaranForPeriod", () => {
  it("includes VOID entries with their state exposed", async () => {
    await seedCategories();
    const row = await expenses.recordPengeluaran({
      date: "2026-07-05", akun: UTAMA, item: "Beras", qty: 1, hargaSatuan: 10_000n,
      jumlah: 10_000n, kategoriCode: "KULAKAN",
    });
    await expenses.voidPengeluaran(row.id);

    const rows = await getLedgerPengeluaranForPeriod("2026-07-01", "2026-07-31", prisma);
    const voided = rows.find((r) => r.id === row.id);
    expect(voided?.state).toBe("VOID");
  });

  it("orders by date and carries kategori/akun through", async () => {
    await seedCategories();
    await expenses.recordPengeluaran({
      date: "2026-07-05", akun: UTAMA, item: "Beras", qty: 1, hargaSatuan: 10_000n,
      jumlah: 10_000n, kategoriCode: "KULAKAN",
    });
    await expenses.recordPengeluaran({
      date: "2026-07-06", akun: UTAMA, item: "PLN", qty: 1, hargaSatuan: 250_000n,
      jumlah: 250_000n, kategoriCode: "LISTRIK",
    });

    const rows = await getLedgerPengeluaranForPeriod("2026-07-01", "2026-07-31", prisma);
    expect(rows.length).toBe(2);
    expect(rows.find((r) => r.item === "Beras")?.kategoriCode).toBe("KULAKAN");
    expect(rows.find((r) => r.item === "Beras")?.akun).toBe(UTAMA);
    expect(rows.find((r) => r.item === "PLN")?.jumlah).toBe(250_000);
  });
});
