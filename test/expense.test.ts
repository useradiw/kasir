/**
 * expense.test.ts — ExpenseRepository (Pengeluaran + Kategori).
 * Categories are module-owned; pengeluaran posts a balanced JE through the
 * ledger engine. tokokencana-native (no storeId / COGS).
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { PrismaClient } from "@/generated/prisma";
import {
  ExpenseRepository,
  DuplicateCategoryCodeError,
  CategoryNotFoundError,
  CategoryInactiveError,
  CategoryInUseError,
  InvalidPengeluaranError,
} from "../lib/accounting/expenseRepository";
import { AccountingRepository } from "../lib/accounting/accountingRepository";
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

describe("ensureDefaultCategories", () => {
  it("seeds defaults once and is idempotent", async () => {
    await expenses.ensureDefaultCategories();
    const first = await expenses.listCategories();
    expect(first.length).toBeGreaterThan(0);
    await expenses.ensureDefaultCategories();
    const second = await expenses.listCategories();
    expect(second.length).toBe(first.length);
  });
});

describe("kategori CRUD", () => {
  it("uppercases code and rejects duplicates", async () => {
    const cat = await expenses.createCategory({ code: "air", name: "Air", bucket: "OPEX" });
    expect(cat.code).toBe("AIR");
    await expect(
      expenses.createCategory({ code: "AIR", name: "Air PDAM", bucket: "OPEX" }),
    ).rejects.toThrow(DuplicateCategoryCodeError);
  });

  it("deletes an unused category but blocks one in use", async () => {
    const unused = await expenses.createCategory({ code: "UNUSED", name: "Unused", bucket: "OPEX" });
    await expenses.deleteCategory(unused.id);
    expect(await prisma.expenseCategory.findUnique({ where: { id: unused.id } })).toBeNull();

    const used = await expenses.createCategory({ code: "LISTRIK", name: "Listrik", bucket: "OPEX" });
    await expenses.recordPengeluaran({
      date: "2026-07-01", akun: UTAMA, item: "PLN", qty: 1, hargaSatuan: 90_000n, jumlah: 90_000n, kategoriCode: "LISTRIK",
    });
    await expect(expenses.deleteCategory(used.id)).rejects.toThrow(CategoryInUseError);
  });
});

describe("recordPengeluaran", () => {
  it("posts Dr Expenses:{bucket}:{code} / Cr kas, balanced", async () => {
    await expenses.createCategory({ code: "KULAKAN", name: "Kulakan", bucket: "HPP" });
    const row = await expenses.recordPengeluaran({
      date: "2026-07-01", akun: UTAMA, item: "Kabel", qty: 10, hargaSatuan: 5_000n, jumlah: 50_000n, kategoriCode: "KULAKAN",
    });
    expect(row.kategoriBucket).toBe("HPP");

    const book = await acc.loadBook();
    expect(book.balance("Expenses:HPP:KULAKAN")).toBe(50_000n);
    expect(book.balance(UTAMA)).toBe(-50_000n);
    expect(book.equationResidual()).toBe(0n);
  });

  it("rejects a missing category, an inactive category, and a non-kas account", async () => {
    await expect(
      expenses.recordPengeluaran({ date: "2026-07-01", akun: UTAMA, item: "x", qty: 1, hargaSatuan: 1n, jumlah: 1n, kategoriCode: "NOPE" }),
    ).rejects.toThrow(CategoryNotFoundError);

    const cat = await expenses.createCategory({ code: "MATI", name: "Mati", bucket: "OPEX" });
    await expenses.updateCategory(cat.id, { active: false });
    await expect(
      expenses.recordPengeluaran({ date: "2026-07-01", akun: UTAMA, item: "x", qty: 1, hargaSatuan: 1n, jumlah: 1n, kategoriCode: "MATI" }),
    ).rejects.toThrow(CategoryInactiveError);

    await expenses.createCategory({ code: "LAIN", name: "Lain", bucket: "OPEX" });
    await expect(
      expenses.recordPengeluaran({ date: "2026-07-01", akun: "Equity:Modal", item: "x", qty: 1, hargaSatuan: 1n, jumlah: 1n, kategoriCode: "LAIN" }),
    ).rejects.toThrow(InvalidPengeluaranError);
  });
});

describe("edit + void pengeluaran", () => {
  it("edit voids original and reposts with the new amount", async () => {
    await expenses.createCategory({ code: "LISTRIK", name: "Listrik", bucket: "OPEX" });
    const row = await expenses.recordPengeluaran({
      date: "2026-07-01", akun: UTAMA, item: "PLN", qty: 1, hargaSatuan: 90_000n, jumlah: 90_000n, kategoriCode: "LISTRIK",
    });
    const edited = await expenses.editPengeluaran(row.id, {
      date: "2026-07-01", akun: UTAMA, item: "PLN", qty: 1, hargaSatuan: 120_000n, jumlah: 120_000n, kategoriCode: "LISTRIK",
    });
    expect(edited.replacesId).toBe(row.id);
    const book = await acc.loadBook();
    expect(book.balance("Expenses:OpEx:LISTRIK")).toBe(120_000n);

    const listed = await expenses.listPengeluaran();
    expect(listed).toHaveLength(1); // the VOID original is excluded
  });

  it("void removes the expense from the ledger (net zero)", async () => {
    await expenses.createCategory({ code: "LAIN", name: "Lain", bucket: "OPEX" });
    const row = await expenses.recordPengeluaran({
      date: "2026-07-01", akun: UTAMA, item: "x", qty: 1, hargaSatuan: 10_000n, jumlah: 10_000n, kategoriCode: "LAIN",
    });
    await expenses.voidPengeluaran(row.id);
    const book = await acc.loadBook();
    expect(book.balance("Expenses:OpEx:LAIN")).toBe(0n);
    expect(book.balance(UTAMA)).toBe(0n);
    expect(await expenses.listPengeluaran()).toHaveLength(0);
  });
});
