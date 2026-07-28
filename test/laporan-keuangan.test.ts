/**
 * laporan-keuangan.test.ts — getLaporanKeuangan (Slice 4 query layer),
 * buildLaporanSections (CSV), and buildCalk (CALK notes).
 *
 * The sales cross-check test is the highest-value test in this slice: kasir
 * posts sales ONCE PER CLOSED DAY, so a day whose register was never closed
 * leaves Transaction rows with nothing posted to the ledger — this proves the
 * cross-check actually catches that gap instead of silently agreeing with
 * itself.
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { PrismaClient } from "@/generated/prisma";
import { AccountingRepository } from "../lib/accounting/accountingRepository";
import { CatatRepository } from "../lib/accounting/catatRepository";
import { buildLaporanKeuangan } from "../lib/laporan-keuangan";
import { buildLaporanSections } from "../lib/laporan-csv";
import { buildCalk, type CalkInput } from "../lib/calk";
import { createTestClient, resetDb } from "./setup";

let prisma: PrismaClient;
let acc: AccountingRepository;
let catat: CatatRepository;

const UTAMA = "Assets:Cash:Utama";

beforeAll(async () => {
  prisma = await createTestClient(["./fixtures/kasir-source-tables.sql"]);
  acc = new AccountingRepository(prisma);
  catat = new CatatRepository(prisma);
});

afterEach(async () => {
  await resetDb(prisma);
  await prisma.$executeRaw`TRUNCATE TABLE transactions, table_sessions, online_settlements CASCADE`;
});

// ---------------------------------------------------------------------------
// No bigint escapes the returned object
// ---------------------------------------------------------------------------

function assertNoBigint(value: unknown, path = "root"): void {
  if (typeof value === "bigint") throw new Error(`bigint leaked at ${path}`);
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoBigint(v, `${path}[${i}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      assertNoBigint(v, `${path}.${k}`);
    }
  }
}

describe("buildLaporanKeuangan", () => {
  it("returns all sections with plain numbers — no bigint anywhere", async () => {
    await catat.recordModal({ date: "2026-07-01", nama: "Adi", akun: UTAMA, jumlah: 500_000n });
    await acc.postEntry({
      date: "2026-07-05",
      narration: "Test sale",
      lines: [
        { account: UTAMA, amount: 200_000n },
        { account: "Income:Sales:Tunai", amount: -200_000n },
      ],
    });

    const laporan = await buildLaporanKeuangan("2026-07", prisma);

    expect(laporan.labaRugi).toBeDefined();
    expect(laporan.neraca).toBeDefined();
    expect(laporan.arusKas).toBeDefined();
    expect(laporan.perubahanModal).toBeDefined();
    expect(laporan.validasi).toBeDefined();
    expect(laporan.calk).toBeDefined();
    assertNoBigint(laporan);
  });

  it("resolves Neraca asset lines to LedgerAccount.label, not the raw Beancount name", async () => {
    await prisma.ledgerAccount.create({
      data: { code: "cash-bank-bca", name: "Assets:Cash:BankBca", label: "Bank BCA", type: "ASSET" },
    });
    await catat.recordModal({ date: "2026-07-01", nama: "Adi", akun: UTAMA, jumlah: 100_000n });
    await catat.recordModal({ date: "2026-07-01", nama: "Adi", akun: "Assets:Cash:BankBca", jumlah: 250_000n });

    const laporan = await buildLaporanKeuangan("2026-07", prisma);
    const bca = laporan.neraca.aset.lines.find((l) => l.account === "Assets:Cash:BankBca");
    const utama = laporan.neraca.aset.lines.find((l) => l.account === UTAMA);

    expect(bca?.label).toBe("Bank BCA");
    // No LedgerAccount row for UTAMA — falls back to the name's last segment,
    // never the raw "Assets:Cash:Utama".
    expect(utama?.label).toBe("Utama");
  });

  it("sales cross-check reports a gap when Transaction rows exist with no day-close posting", async () => {
    await prisma.tableSession.create({ data: { id: "ts-1", name: "Meja 1" } });
    await prisma.transaction.create({
      data: {
        id: "tx-1",
        tableSessionId: "ts-1",
        processedById: "staff-1",
        subtotal: 500_000,
        totalAmount: 500_000,
        cashAmount: 500_000,
        qrisAmount: 0,
        paymentMethod: "CASH",
        status: "PAID",
        paidAt: new Date(2026, 6, 10), // local July 10, 2026 — inside the period
      },
    });

    const withoutPosting = await buildLaporanKeuangan("2026-07", prisma);
    expect(withoutPosting.validasi.sales_crosscheck.tunai_gap).not.toBe(0);
    expect(withoutPosting.validasi.sales_crosscheck.total_gap).not.toBe(0);
    expect(withoutPosting.validasi.all_pass).toBe(false);

    // Now post the matching day-close entry — the gap must close to zero.
    await acc.postEntry({
      date: "2026-07-10",
      narration: "Tutup kas 2026-07-10",
      lines: [
        { account: UTAMA, amount: 500_000n },
        { account: "Income:Sales:Tunai", amount: -500_000n },
      ],
    });
    const withPosting = await buildLaporanKeuangan("2026-07", prisma);
    expect(withPosting.validasi.sales_crosscheck.tunai_gap).toBe(0);
    expect(withPosting.validasi.sales_crosscheck.total_gap).toBe(0);
  });

  it("online sale totals come from OnlineSettlement gross in the period, not Transaction", async () => {
    await prisma.onlineSettlement.create({
      data: {
        id: "settle-1",
        service: "GoFood",
        settlementDate: new Date(2026, 6, 15),
        totalGross: 300_000,
        commissionAmount: 30_000,
        finalAmount: 270_000,
        settledById: "staff-1",
      },
    });

    const withoutPosting = await buildLaporanKeuangan("2026-07", prisma);
    // Ledger has no Income:Sales:Online for this period -> ledger online (0)
    // vs settlement gross (300_000) shows up as part of the total gap.
    expect(withoutPosting.validasi.sales_crosscheck.total_gap).not.toBe(0);
  });
});

describe("buildLaporanSections", () => {
  it("produces the six sections with the right titles, safe on an empty book", async () => {
    const laporan = await buildLaporanKeuangan("2026-07", prisma);
    const sections = buildLaporanSections(laporan);

    expect(sections.map((s) => s.title)).toEqual([
      "LABA RUGI",
      "NERACA",
      "ARUS KAS",
      "PERUBAHAN MODAL",
      "VALIDASI",
      "CATATAN ATAS LAPORAN KEUANGAN",
    ]);
    for (const s of sections) {
      expect(Array.isArray(s.headers)).toBe(true);
      expect(Array.isArray(s.rows)).toBe(true);
    }
  });
});

describe("buildCalk", () => {
  const laporan: CalkInput = {
    period: { dateFrom: "2026-07-01", dateTo: "2026-07-31" },
    labaRugi: {
      pendapatan: { tunai: 300_000, qris: 200_000, online: 100_000, total: 600_000 },
      hpp: { lines: [{ label: "Kulakan", amount: 120_000 }], total: 120_000 },
      biaya_operasional: { lines: [{ label: "Sewa", amount: 50_000 }], total: 50_000 },
    },
    neraca: {
      aset: { lines: [{ account: "Assets:Cash:Utama", label: "Kas Utama", amount: 900_000 }] },
    },
    perubahanModal: { modal_awal: 1_000_000, tambahan_modal: 0, prive: 50_000, modal_akhir: 1_380_000 },
  };

  it("fills generated values from the laporan and passes notes through", () => {
    const calk = buildCalk(laporan, { "rincian-kas": "Kas fisik dicek tiap minggu." });
    expect(calk.sections).toHaveLength(6);

    const kas = calk.sections.find((s) => s.key === "rincian-kas");
    expect(kas?.generated).toEqual([{ label: "Kas Utama", value: 900_000 }]);
    expect(kas?.note).toBe("Kas fisik dicek tiap minggu.");

    const pendapatan = calk.sections.find((s) => s.key === "rincian-pendapatan");
    expect(pendapatan?.generated).toContainEqual({ label: "Tunai", value: 300_000 });
    expect(pendapatan?.generated).toContainEqual({ label: "Online", value: 100_000 });

    const ekuitas = calk.sections.find((s) => s.key === "ekuitas");
    // Displayed negated (outflow), matching the CSV convention.
    expect(ekuitas?.generated).toContainEqual({ label: "Prive", value: -50_000 });

    // A section never annotated gets "".
    const dasar = calk.sections.find((s) => s.key === "dasar-penyusunan");
    expect(dasar?.note).toBe("");
  });
});
