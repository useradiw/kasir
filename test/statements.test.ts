/**
 * statements.test.ts — the five statement-engine modules (lib/accounting/
 * incomeStatement, balanceSheet, cashFlow, changesInEquity, validate), which
 * have NEVER had test coverage before this slice.
 *
 * Entries are posted through the REAL repositories (AccountingRepository,
 * ExpenseRepository, CatatRepository) against pglite, exercising the same
 * path production uses — not hand-inserted rows.
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { PrismaClient } from "@/generated/prisma";
import { AccountingRepository } from "../lib/accounting/accountingRepository";
import { ExpenseRepository } from "../lib/accounting/expenseRepository";
import { CatatRepository } from "../lib/accounting/catatRepository";
import { incomeStatement } from "../lib/accounting/incomeStatement";
import { balanceSheet } from "../lib/accounting/balanceSheet";
import { cashFlow } from "../lib/accounting/cashFlow";
import { changesInEquity } from "../lib/accounting/changesInEquity";
import { runValidations } from "../lib/accounting/validate";
import { createTestClient, resetDb } from "./setup";

let prisma: PrismaClient;
let acc: AccountingRepository;
let expenses: ExpenseRepository;
let catat: CatatRepository;

const UTAMA = "Assets:Cash:Utama";

beforeAll(async () => {
  prisma = await createTestClient();
  acc = new AccountingRepository(prisma);
  expenses = new ExpenseRepository(prisma);
  catat = new CatatRepository(prisma);
});

afterEach(async () => {
  await resetDb(prisma);
});

/** Direct cash-sale posting (Dr kas / Cr Income:Sales:<channel>) — statement
 *  tests don't need the day-close posting machinery, just ledger entries. */
async function postCashSale(date: string, account: string, amount: bigint) {
  await acc.postEntry({
    date,
    narration: `Test sale ${account}`,
    lines: [
      { account: UTAMA, amount },
      { account, amount: -amount },
    ],
  });
}

describe("Neraca (balanceSheet)", () => {
  it("balances: Aset == Kewajiban + Ekuitas on a non-trivial book", async () => {
    await catat.recordModal({ date: "2026-07-01", nama: "Adi", akun: UTAMA, jumlah: 1_000_000n });
    await catat.recordSaldoAwal({ date: "2026-07-01", akun: UTAMA, jumlah: 200_000n });
    await postCashSale("2026-07-05", "Income:Sales:Tunai", 500_000n);

    await expenses.createCategory({ code: "LISTRIK", name: "Listrik", bucket: "OPERASIONAL" });
    await expenses.recordPengeluaran({
      date: "2026-07-06", akun: UTAMA, item: "PLN", qty: 1, hargaSatuan: 150_000n, jumlah: 150_000n, kategoriCode: "LISTRIK",
    });

    await catat.recordPrive({ date: "2026-07-10", akun: UTAMA, jumlah: 100_000n });

    const book = await acc.loadBook({ dateTo: "2026-07-31" });
    const bs = balanceSheet(book, "2026-07-31");
    expect(bs.balanced).toBe(true);
    expect(bs.aset.total).toBe(bs.kewajiban.total + bs.ekuitas.total);
  });
});

describe("Laba Rugi (incomeStatement)", () => {
  it("ties to ledger sums: pendapatan, bahan baku, laba kotor/bersih, tunai/qris/online split", async () => {
    await postCashSale("2026-07-05", "Income:Sales:Tunai", 300_000n);
    await postCashSale("2026-07-06", "Income:Sales:QRIS", 200_000n);
    await postCashSale("2026-07-07", "Income:Sales:Online", 100_000n);

    await expenses.createCategory({ code: "KULAKAN", name: "Kulakan", bucket: "BAHAN_BAKU" });
    await expenses.createCategory({ code: "SEWA", name: "Sewa", bucket: "OPERASIONAL" });
    await expenses.recordPengeluaran({
      date: "2026-07-08", akun: UTAMA, item: "Barang", qty: 1, hargaSatuan: 120_000n, jumlah: 120_000n, kategoriCode: "KULAKAN",
    });
    await expenses.recordPengeluaran({
      date: "2026-07-09", akun: UTAMA, item: "Sewa toko", qty: 1, hargaSatuan: 50_000n, jumlah: 50_000n, kategoriCode: "SEWA",
    });

    const book = await acc.loadBook({ dateTo: "2026-07-31" });
    const cats = { KULAKAN: { name: "Kulakan" }, SEWA: { name: "Sewa" } };
    const ls = incomeStatement(book, "2026-07-01", "2026-07-31", cats);

    expect(ls.pendapatan.total).toBe(-book.balancePrefix("Income:", "2026-07-01", "2026-07-31"));
    expect(ls.pendapatan.tunai).toBe(300_000n);
    expect(ls.pendapatan.qris).toBe(200_000n);
    expect(ls.pendapatan.online).toBe(100_000n);
    expect(ls.pendapatan.total).toBe(600_000n);
    expect(ls.pengeluaran_bahan_baku.total).toBe(120_000n);
    expect(ls.laba_kotor).toBe(ls.pendapatan.total - ls.pengeluaran_bahan_baku.total);
    expect(ls.pengeluaran_operasional.total).toBe(50_000n);
    expect(ls.laba_bersih).toBe(ls.laba_kotor - ls.pengeluaran_operasional.total);
  });
});

describe("Arus Kas (cashFlow)", () => {
  it("reconciles kas_akhir - kas_awal == kenaikan_kas_bersih, delta_cash_check == 0", async () => {
    await catat.recordModal({ date: "2026-07-01", nama: "Adi", akun: UTAMA, jumlah: 1_000_000n });
    await postCashSale("2026-07-05", "Income:Sales:Tunai", 300_000n);
    await expenses.createCategory({ code: "LAIN", name: "Lain", bucket: "OPERASIONAL" });
    await expenses.recordPengeluaran({
      date: "2026-07-06", akun: UTAMA, item: "x", qty: 1, hargaSatuan: 100_000n, jumlah: 100_000n, kategoriCode: "LAIN",
    });

    const book = await acc.loadBook({ dateTo: "2026-07-31" });
    const cf = cashFlow(book, "2026-07-01", "2026-07-31");

    expect(cf.kas_akhir - cf.kas_awal).toBe(cf.kenaikan_kas_bersih);
    expect(cf.delta_cash_check).toBe(cf.kenaikan_kas_bersih);
  });

  it("classifies Prive as pendanaan, never operasi — and Modal/Saldo Awal also land in pendanaan", async () => {
    await catat.recordModal({ date: "2026-07-01", nama: "Adi", akun: UTAMA, jumlah: 500_000n });
    await catat.recordSaldoAwal({ date: "2026-07-01", akun: UTAMA, jumlah: 200_000n });
    await postCashSale("2026-07-02", "Income:Sales:Tunai", 100_000n);
    await catat.recordPrive({ date: "2026-07-03", akun: UTAMA, jumlah: 50_000n });
    await expenses.createCategory({ code: "LAIN", name: "Lain", bucket: "OPERASIONAL" });
    await expenses.recordPengeluaran({
      date: "2026-07-04", akun: UTAMA, item: "x", qty: 1, hargaSatuan: 20_000n, jumlah: 20_000n, kategoriCode: "LAIN",
    });

    const book = await acc.loadBook({ dateTo: "2026-07-31" });
    const cf = cashFlow(book, "2026-07-01", "2026-07-31");

    expect(cf.setoran_modal).toBe(500_000n);
    expect(cf.setoran_saldo_awal).toBe(200_000n);
    // Debit-positive engine convention on Equity:Prive (see changesInEquity.ts);
    // as a CASH FLOW its share is the cash leaving the drawer, i.e. negative.
    expect(cf.pengambilan_prive).toBe(-50_000n);
    // Operasi holds ONLY the sale (+100_000) and the expense (-20_000) — Prive/
    // Modal/Saldo Awal must NOT leak into it (the shipped tokokencana bug).
    expect(cf.operasi).toBe(100_000n - 20_000n);
    expect(cf.pendanaan).toBe(500_000n + 200_000n - 50_000n);
  });
});

describe("Perubahan Modal (changesInEquity)", () => {
  it("modal_akhir == modal_awal + tambahan_modal + laba_bersih - prive, and ties to Neraca ekuitas", async () => {
    await catat.recordModal({ date: "2026-06-01", nama: "Adi", akun: UTAMA, jumlah: 1_000_000n });
    await postCashSale("2026-07-05", "Income:Sales:Tunai", 300_000n);
    await catat.recordPrive({ date: "2026-07-10", akun: UTAMA, jumlah: 50_000n });

    const book = await acc.loadBook({ dateTo: "2026-07-31" });
    const ce = changesInEquity(book, "2026-07-01", "2026-07-31");
    const bs = balanceSheet(book, "2026-07-31");

    expect(ce.modal_akhir).toBe(ce.modal_awal + ce.tambahan_modal + ce.laba_bersih - ce.prive);
    expect(ce.modal_akhir).toBe(bs.ekuitas.total);
  });

  it("modal_awal picks up only pre-period equity", async () => {
    await catat.recordModal({ date: "2026-06-15", nama: "Adi", akun: UTAMA, jumlah: 1_000_000n });
    await catat.recordModal({ date: "2026-07-10", nama: "Adi", akun: UTAMA, jumlah: 400_000n });

    const book = await acc.loadBook({ dateTo: "2026-07-31" });
    const ce = changesInEquity(book, "2026-07-01", "2026-07-31");

    expect(ce.modal_awal).toBe(1_000_000n); // June's deposit only
    expect(ce.tambahan_modal).toBe(400_000n); // July's deposit, separately
  });
});

describe("Period scoping", () => {
  it("excludes an out-of-period entry from Laba Rugi/Arus Kas but includes it in Neraca's cumulative figures", async () => {
    await postCashSale("2026-06-15", "Income:Sales:Tunai", 250_000n);

    const book = await acc.loadBook({ dateTo: "2026-07-31" });
    const ls = incomeStatement(book, "2026-07-01", "2026-07-31");
    const cf = cashFlow(book, "2026-07-01", "2026-07-31");
    const bs = balanceSheet(book, "2026-07-31");

    expect(ls.pendapatan.total).toBe(0n);
    expect(cf.operasi).toBe(0n);
    // Neraca is as-of dateTo, cumulative from the beginning of time.
    expect(bs.aset.total_kas).toBe(250_000n);
  });
});

describe("VOID nets to zero", () => {
  it("a voided entry plus its reversal nets to zero in every statement", async () => {
    const posted = await acc.postEntry({
      date: "2026-07-05",
      narration: "Test sale",
      lines: [
        { account: UTAMA, amount: 300_000n },
        { account: "Income:Sales:Tunai", amount: -300_000n },
      ],
    });
    await acc.voidEntry(posted.id);

    const book = await acc.loadBook({ dateTo: "2026-07-31" });
    const ls = incomeStatement(book, "2026-07-01", "2026-07-31");
    const bs = balanceSheet(book, "2026-07-31");
    const cf = cashFlow(book, "2026-07-01", "2026-07-31");

    expect(ls.pendapatan.total).toBe(0n);
    expect(bs.aset.total_kas).toBe(0n);
    expect(bs.balanced).toBe(true);
    expect(cf.kenaikan_kas_bersih).toBe(0n);
  });
});

describe("runValidations", () => {
  it("all_pass is true on a clean book", async () => {
    await catat.recordModal({ date: "2026-07-01", nama: "Adi", akun: UTAMA, jumlah: 500_000n });
    await postCashSale("2026-07-05", "Income:Sales:Tunai", 200_000n);

    const book = await acc.loadBook({ dateTo: "2026-07-31" });
    const result = runValidations(book, "2026-07-01", "2026-07-31");
    expect(result.all_pass).toBe(true);
  });

  it("fails and names the failing check on a deliberately inconsistent book", async () => {
    await catat.recordModal({ date: "2026-07-01", nama: "Adi", akun: UTAMA, jumlah: 500_000n });
    // Post directly into Income:Unclassified — a real posting bug (unmapped
    // sales channel falling through to suspense), not an unbalanced entry.
    await acc.postEntry({
      date: "2026-07-05",
      narration: "Unclassified deposit",
      lines: [
        { account: UTAMA, amount: 75_000n },
        { account: "Income:Unclassified", amount: -75_000n },
      ],
    });

    const book = await acc.loadBook({ dateTo: "2026-07-31" });
    const result = runValidations(book, "2026-07-01", "2026-07-31");

    expect(result.all_pass).toBe(false);
    const failing = result.checks.find((c) => c.name === "Tidak ada saldo Suspense / Unclassified");
    expect(failing?.pass).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Regression: expense accounts outside Expenses:BahanBaku:/Expenses:Operasional: (2026-07-28)
// ---------------------------------------------------------------------------

describe("Laba Rugi — expense accounts outside both bucket prefixes", () => {
  /** Post a cash shortage the way tutup kas does: Dr Expenses:SelisihKas / Cr kas. */
  async function postSelisihKas(date: string, amount: bigint) {
    await acc.postEntry({
      date,
      narration: `Selisih kas ${date}`,
      lines: [
        { account: "Expenses:SelisihKas", amount },
        { account: UTAMA, amount: -amount },
      ],
    });
  }

  it("counts Expenses:SelisihKas in biaya operasional, not silently dropping it", async () => {
    await postCashSale("2026-07-05", "Income:Sales:Tunai", 1_000_000n);
    await postSelisihKas("2026-07-06", 25_000n);

    const book = await acc.loadBook({ dateTo: "2026-07-31" });
    const ls = incomeStatement(book, "2026-07-01", "2026-07-31");

    // Was the bug: pengeluaran_operasional summed only "Expenses:Operasional:", so a
    // SelisihKas shortage vanished and laba bersih came out 25.000 too high.
    expect(ls.pengeluaran_operasional.total).toBe(25_000n);
    expect(ls.pengeluaran_operasional.lines.some((l) => l.account === "Expenses:SelisihKas")).toBe(true);
    expect(ls.laba_bersih).toBe(975_000n);
  });

  it("labels SelisihKas readably even though no ExpenseCategory backs it", async () => {
    await postSelisihKas("2026-07-06", 10_000n);
    const book = await acc.loadBook({ dateTo: "2026-07-31" });
    const ls = incomeStatement(book, "2026-07-01", "2026-07-31");
    const line = ls.pengeluaran_operasional.lines.find((l) => l.account === "Expenses:SelisihKas");
    expect(line?.label).toBe("Selisih Kas");
  });

  it("keeps Laba Rugi consistent with Perubahan Modal when a selisih exists", async () => {
    await catat.recordSaldoAwal({ date: "2026-06-30", akun: UTAMA, jumlah: 500_000n });
    await postCashSale("2026-07-05", "Income:Sales:Tunai", 1_000_000n);
    await postSelisihKas("2026-07-06", 25_000n);

    const book = await acc.loadBook({ dateTo: "2026-07-31" });
    const ls = incomeStatement(book, "2026-07-01", "2026-07-31");
    const ce = changesInEquity(book, "2026-07-01", "2026-07-31");

    // The mismatch that exposed the bug: these two disagreed by the selisih.
    expect(ls.laba_bersih).toBe(ce.laba_bersih);
  });

  it("runValidations recomputes laba bersih from the ledger, so the check is not a tautology", async () => {
    await postCashSale("2026-07-05", "Income:Sales:Tunai", 1_000_000n);
    await postSelisihKas("2026-07-06", 25_000n);

    const book = await acc.loadBook({ dateTo: "2026-07-31" });
    const result = runValidations(book, "2026-07-01", "2026-07-31");

    const labaCheck = result.checks.find((c) => c.name.startsWith("Laba Rugi:"));
    expect(labaCheck?.pass).toBe(true);
    // The detail must carry the INDEPENDENT figure, derived from
    // -(Income + Expenses) = -(-1.000.000 + 25.000) = 975.000.
    expect(labaCheck?.detail).toContain("975000");
    expect(result.all_pass).toBe(true);
  });
});

describe("Neraca — the Ekuitas column must add up to its own total", () => {
  it("sum(ekuitas.lines) === ekuitas.total, with Prive signed as a reduction", async () => {
    await catat.recordSaldoAwal({ date: "2026-07-01", akun: UTAMA, jumlah: 2_000_000n });
    await catat.recordModal({ date: "2026-07-02", nama: "Adi", akun: UTAMA, jumlah: 1_000_000n });
    await postCashSale("2026-07-05", "Income:Sales:Tunai", 1_000_000n);
    await catat.recordPrive({ date: "2026-07-25", nama: "Adi", akun: UTAMA, jumlah: 1_000_000n });

    const book = await acc.loadBook({ dateTo: "2026-07-31" });
    const bs = balanceSheet(book, "2026-07-31");

    const sum = bs.ekuitas.lines.reduce((s, l) => s + l.amount, 0n);
    expect(sum).toBe(bs.ekuitas.total);

    // Prive must read as a REDUCTION. It was emitted positive, so the column
    // showed Modal + Saldo Awal + Prive + Saldo Laba overshooting its total.
    const priveLine = bs.ekuitas.lines.find((l) => l.label === "Prive");
    expect(priveLine?.amount).toBe(-1_000_000n);
    expect(bs.balanced).toBe(true);
  });
});
