/**
 * shell-queries.test.ts — lib/shell-queries.ts (Beranda/Buku shell queries).
 *
 * Every function takes `db: PrismaClient = prisma`, so the real code runs
 * against pglite — never the production singleton. reconcileCashDates and
 * getNonSalesCashMovementByDate now take the same injectable db, so the
 * open-register and revenue branches run here too instead of only being
 * exercised on an empty database.
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { PrismaClient } from "@/generated/prisma";
import {
  getBukuSetupStatus,
  getUnpostedDayCloses,
  unpostedReason,
  getTodayOverview,
  getStaffSalesToday,
  setupSteps,
  type BukuSetupStatus,
} from "@/lib/shell-queries";
import { createTestClient, resetDb } from "./setup";

let prisma: PrismaClient;

beforeAll(async () => {
  // The suite applies the REAL migration chain, so the operational tables
  // (cash_registers, transactions) exist for real — no extra DDL needed here.
  prisma = await createTestClient();
});

afterEach(async () => {
  // cash_registers is not in resetDb's ledger list — clear it separately.
  await prisma.$executeRaw`TRUNCATE TABLE cash_registers CASCADE`;
  await resetDb(prisma);
});

// ─── setupSteps (pure) ──────────────────────────────────────────────────────

const FULL_CHANNELS = { tunai: "Assets:Cash:KasLaci", elektronik: "Assets:Cash:BankBCA", online: "Assets:Cash:BankBCA" };
const NO_CHANNELS = { tunai: null, elektronik: null, online: null };

const status = (over: Partial<BukuSetupStatus> = {}): BukuSetupStatus => ({
  accountsSeeded: true,
  cashAccountsCount: 1,
  channels: { ...FULL_CHANNELS },
  categoriesCount: 3,
  ...over,
});

describe("setupSteps", () => {
  it("marks all four steps done on a fully set-up buku", () => {
    const steps = setupSteps(status());
    expect(steps.map((s) => s.done)).toEqual([true, true, true, true]);
    expect(steps.map((s) => s.label)).toEqual([
      "Isi akun default",
      "Buat akun kas",
      "Petakan akun penjualan",
      "Isi kategori pengeluaran",
    ]);
  });

  it("marks nothing done on an untouched buku", () => {
    const steps = setupSteps(
      status({ accountsSeeded: false, cashAccountsCount: 0, channels: { ...NO_CHANNELS }, categoriesCount: 0 }),
    );
    expect(steps.some((s) => s.done)).toBe(false);
  });

  it("every step tracks its own input across all 16 combinations", () => {
    for (const accountsSeeded of [false, true]) {
      for (const cashAccountsCount of [0, 2]) {
        for (const mapped of [false, true]) {
          for (const categoriesCount of [0, 2]) {
            const steps = setupSteps(
              status({
                accountsSeeded,
                cashAccountsCount,
                channels: mapped ? { ...FULL_CHANNELS } : { ...NO_CHANNELS },
                categoriesCount,
              }),
            );
            expect(steps[0].done).toBe(accountsSeeded);
            expect(steps[1].done).toBe(cashAccountsCount > 0);
            expect(steps[2].done).toBe(mapped);
            expect(steps[3].done).toBe(categoriesCount > 0);
          }
        }
      }
    }
  });

  it("names the unmapped channels in the petakan step", () => {
    const steps = setupSteps(status({ channels: { tunai: "Assets:Cash:KasLaci", elektronik: null, online: null } }));
    expect(steps[2].done).toBe(false);
    expect(steps[2].detail).toBe("Belum dipetakan: elektronik, online.");
  });

  it("reports the cash-account count once kas accounts exist", () => {
    const none = setupSteps(status({ cashAccountsCount: 0 }));
    expect(none[1].detail).toBe("Belum ada akun kas — kamu yang mendefinisikan.");
    const two = setupSteps(status({ cashAccountsCount: 2 }));
    expect(two[1].detail).toBe("2 akun kas siap.");
  });
});

// ─── getBukuSetupStatus (db) ────────────────────────────────────────────────

describe("getBukuSetupStatus", () => {
  it("reports everything missing on an empty database", async () => {
    const s = await getBukuSetupStatus(prisma);
    expect(s).toEqual({
      accountsSeeded: false,
      cashAccountsCount: 0,
      channels: { tunai: null, elektronik: null, online: null },
      categoriesCount: 0,
    });
  });

  it("counts cash accounts once the chart of accounts is seeded, channels still unmapped", async () => {
    await prisma.ledgerAccount.create({
      data: { code: "Assets:Cash:KasLaci", name: "Assets:Cash:KasLaci", label: "Kas Laci", type: "ASSET" },
    });
    await prisma.ledgerAccount.create({
      data: { code: "Assets:Cash:BankBCA", name: "Assets:Cash:BankBCA", label: "Bank BCA", type: "ASSET" },
    });
    await prisma.ledgerAccount.create({
      data: { code: "Income:Sales:Tunai", name: "Income:Sales:Tunai", type: "INCOME" },
    });

    const s = await getBukuSetupStatus(prisma);
    expect(s.accountsSeeded).toBe(true);
    expect(s.cashAccountsCount).toBe(2);
    expect(s.channels).toEqual({ tunai: null, elektronik: null, online: null });
  });

  it("picks up a channel mapping once set", async () => {
    await prisma.ledgerAccount.create({
      data: { code: "Assets:Cash:KasLaci", name: "Assets:Cash:KasLaci", label: "Kas Laci", type: "ASSET" },
    });
    await prisma.salesChannelAccount.create({
      data: { channel: "tunai", account: "Assets:Cash:KasLaci" },
    });

    const s = await getBukuSetupStatus(prisma);
    expect(s.channels.tunai).toBe("Assets:Cash:KasLaci");
    expect(s.channels.elektronik).toBeNull();
  });
});

// ─── getUnpostedDayCloses (db) ──────────────────────────────────────────────

describe("getUnpostedDayCloses", () => {
  it("returns nothing on an empty database", async () => {
    expect(await getUnpostedDayCloses(5, prisma)).toEqual([]);
  });

  it("returns a closed day with no ledger entry and excludes a posted one and an open one", async () => {
    const posted = await prisma.cashRegister.create({
      data: { date: new Date(2026, 7, 14), openingCash: 100_000, closingCash: 250_000 },
    });
    await prisma.cashRegister.create({
      data: { date: new Date(2026, 7, 15), openingCash: 100_000, closingCash: 300_000 },
    });
    await prisma.cashRegister.create({
      data: { date: new Date(2026, 7, 16), openingCash: 100_000, closingCash: null },
    });
    await prisma.ledgerPosting.create({
      data: { sourceType: "shift-close", sourceId: posted.id, journalEntryId: "je-fake" },
    });

    const unposted = await getUnpostedDayCloses(5, prisma);
    expect(unposted).toHaveLength(1);
    expect(unposted[0].closingCash).toBe(300_000);
    expect(unposted[0].date).toEqual(new Date(2026, 7, 15));
    // Nothing is mapped on an empty database, so that is the named reason.
    expect(unposted[0].reason).toMatch(/Akun penjualan belum dipetakan/);
  });
});

describe("unpostedReason", () => {
  it("names the unmapped channels first — the usual cause during setup", () => {
    expect(unpostedReason("2026-08-15", "2026-07-31", ["tunai", "online"])).toBe(
      "Akun penjualan belum dipetakan: tunai, online.",
    );
  });

  it("blames the lock only for a day inside a locked month", () => {
    expect(unpostedReason("2026-07-15", "2026-07-31", [])).toBe(
      "Bulan itu sudah dikunci — buka dulu bulannya.",
    );
    expect(unpostedReason("2026-08-01", "2026-07-31", [])).toBeNull();
  });

  it("claims no cause when nothing knowable explains it", () => {
    expect(unpostedReason("2026-08-15", null, [])).toBeNull();
  });
});

describe("getUnpostedDayCloses: a day that posts nothing by design", () => {
  it("does not flag a closed day with no sales and an exact cash count", async () => {
    // postDayClose writes NOTHING for such a day, so it has no LedgerPosting
    // and never will. Flagging it would leave a warning no button can clear.
    await prisma.cashRegister.create({
      data: { date: new Date(2026, 7, 20), openingCash: 150_000, closingCash: 150_000 },
    });
    expect(await getUnpostedDayCloses(5, prisma)).toEqual([]);
  });

  it("still flags a closed day whose count does not match", async () => {
    await prisma.cashRegister.create({
      data: { date: new Date(2026, 7, 21), openingCash: 150_000, closingCash: 140_000 },
    });
    const unposted = await getUnpostedDayCloses(5, prisma);
    expect(unposted).toHaveLength(1);
    expect(unposted[0].closingCash).toBe(140_000);
  });
});

// ─── overview / staff sales on an empty database ────────────────────────────

describe("getTodayOverview / getStaffSalesToday", () => {
  it("getTodayOverview returns zeros, not a throw, on an empty database", async () => {
    const overview = await getTodayOverview(prisma);
    expect(overview).toEqual({
      salesToday: 0,
      txnsToday: 0,
      qrisToday: 0,
      salesYesterday: 0,
      openRegister: null,
      expensesToday: 0,
      salaryToday: 0,
      staffPresentToday: 0,
      staffTotalToday: 0,
    });
  });

  it("recognises an online order only once its pencairan lands", async () => {
    const staff = await prisma.staff.create({
      data: { name: "Adi", username: `adi-${Date.now()}`, role: "CASHIER" },
    });
    const now = new Date();
    const mkSale = async (total: number, service: "GoFood" | null) => {
      const session = await prisma.tableSession.create({
        data: { name: service ?? "Meja 1", service: service ?? undefined },
      });
      return prisma.transaction.create({
        data: {
          tableSessionId: session.id,
          processedById: staff.id,
          subtotal: total,
          totalAmount: total,
          cashAmount: service ? 0 : total,
          paymentMethod: service ? "PENDING" : "CASH",
          status: "PAID",
          paidAt: now,
        },
      });
    };

    await mkSale(500_000, null);
    const online = await mkSale(200_000, "GoFood");

    // Before the pencairan: the platform still holds the 200.000.
    const before = await getTodayOverview(prisma);
    expect(before.salesToday).toBe(500_000);
    expect(before.txnsToday).toBe(2);

    const settlement = await prisma.onlineSettlement.create({
      data: {
        service: "GoFood",
        totalGross: 200_000,
        commissionAmount: 40_000,
        finalAmount: 160_000,
        settledById: staff.id,
      },
    });
    await prisma.settlementItem.create({
      data: { settlementId: settlement.id, transactionId: online.id },
    });

    // After it: the disbursed amount, net of commission — never the gross.
    const after = await getTodayOverview(prisma);
    expect(after.salesToday).toBe(660_000);
  });

  it("getStaffSalesToday returns zeros for an unknown staff id", async () => {
    expect(await getStaffSalesToday("staff-tidak-ada", prisma)).toEqual({
      salesToday: 0,
      txnsToday: 0,
    });
  });
});
