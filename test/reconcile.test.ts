/**
 * reconcile.test.ts — the PURE half of app/actions/admin/queries/_shared.ts:
 * getDateRange and reconcileRegisterDay. No DB.
 *
 * reconcileCashDates is deliberately NOT tested here: it closes over the
 * Prisma singleton (no injectable db), and _shared.ts must never gain a
 * "use server" line — that would turn it into an unauthenticated endpoint.
 * It is covered indirectly through the cash-register screen queries.
 *
 * Sign convention (read from the function, don't trust memory):
 *   difference = closingCash − expectedClosing
 * so a SHORT day (counted below expected) is NEGATIVE and a surplus is
 * POSITIVE — the opposite of the Cek Saldo badge, whose selisih
 * (saldoLedger − saldoTercatat) is positive when cash is missing. The
 * register UI prints difference ≥ 0 with a "+" and negative in red.
 */

import { describe, it, expect } from "vitest";
import {
  getDateRange,
  reconcileRegisterDay,
} from "@/app/actions/admin/queries/_shared";

/** Last millisecond of a local calendar day. */
const lastMoment = (y: number, m: number, d: number) => new Date(y, m - 1, d, 23, 59, 59, 999);

describe("getDateRange", () => {
  it("daily covers exactly one day, inclusive of its last moment", () => {
    const { start, end } = getDateRange("daily", "2026-08-15");
    expect(start).toEqual(new Date(2026, 7, 15));
    expect(end).toEqual(new Date(2026, 7, 16));
    expect(lastMoment(2026, 8, 15) < end).toBe(true);
  });

  it("weekly starts Monday and covers through the following Sunday", () => {
    // 2026-08-15 is a Saturday, so the week runs Mon 10 → Sun 16 Aug.
    const { start, end } = getDateRange("weekly", "2026-08-15");
    expect(start).toEqual(new Date(2026, 7, 10));
    expect(start.getDay()).toBe(1);
    expect(end).toEqual(new Date(2026, 7, 17));
    expect(lastMoment(2026, 8, 16) < end).toBe(true);
  });

  it("monthly covers the whole month, inclusive of its last moment", () => {
    const { start, end } = getDateRange("monthly", "2026-08-15");
    expect(start).toEqual(new Date(2026, 7, 1));
    expect(end).toEqual(new Date(2026, 8, 1));
    expect(lastMoment(2026, 8, 31) < end).toBe(true);
  });

  it("monthly handles a non-leap February via date overflow", () => {
    const { start, end } = getDateRange("monthly", "2026-02-10");
    expect(start).toEqual(new Date(2026, 1, 1));
    expect(end).toEqual(new Date(2026, 2, 1));
    expect(lastMoment(2026, 2, 28) < end).toBe(true);
  });

  it("yearly covers the whole calendar year, inclusive of its last moment", () => {
    const { start, end } = getDateRange("yearly", "2026-08-15");
    expect(start).toEqual(new Date(2026, 0, 1));
    expect(end).toEqual(new Date(2027, 0, 1));
    expect(lastMoment(2026, 12, 31) < end).toBe(true);
  });
});

describe("reconcileRegisterDay", () => {
  const date = new Date(2026, 7, 15); // local midnight, localDateKey "2026-08-15"
  const byDate = (cash: number, nonSales: number, qris = 0) => ({
    cash: { "2026-08-15": cash },
    qris: { "2026-08-15": qris },
    nonSales: { "2026-08-15": nonSales },
  });

  it("an exactly balanced day reports a zero selisih", () => {
    // 100000 opening + 150000 tunai − 30000 pengeluaran = 220000 expected.
    const r = reconcileRegisterDay(
      { openingCash: 100_000, closingCash: 220_000, date },
      byDate(150_000, -30_000),
    );
    expect(r.cashIncome).toBe(150_000);
    expect(r.totalExpenses).toBe(30_000);
    expect(r.expectedClosing).toBe(220_000);
    expect(r.difference).toBe(0);
    expect(r.nothingToPost).toBe(false);
  });

  it("a short day reports a NEGATIVE selisih (counted below expected)", () => {
    const r = reconcileRegisterDay(
      { openingCash: 100_000, closingCash: 200_000, date },
      byDate(150_000, -30_000),
    );
    expect(r.expectedClosing).toBe(220_000);
    expect(r.difference).toBe(-20_000);
    expect(r.nothingToPost).toBe(false);
  });

  it("a surplus reports a POSITIVE selisih (counted above expected)", () => {
    const r = reconcileRegisterDay(
      { openingCash: 100_000, closingCash: 225_000, date },
      byDate(150_000, -30_000),
    );
    expect(r.difference).toBe(5_000);
  });

  it("a transfer/modal INTO the drawer raises expected closing and is not an expense", () => {
    const r = reconcileRegisterDay(
      { openingCash: 100_000, closingCash: 150_000, date },
      byDate(0, 50_000),
    );
    expect(r.expectedClosing).toBe(150_000);
    expect(r.totalExpenses).toBe(0);
    expect(r.difference).toBe(0);
  });

  it("treats missing byDate entries for the day as zeros", () => {
    const r = reconcileRegisterDay(
      { openingCash: 50_000, closingCash: 50_000, date },
      { cash: {}, qris: {}, nonSales: {} },
    );
    expect(r.cashIncome).toBe(0);
    expect(r.qrisIncome).toBe(0);
    expect(r.expectedClosing).toBe(50_000);
    expect(r.difference).toBe(0);
  });

  it("a no-sales, exact-count day is nothing to post", () => {
    const r = reconcileRegisterDay(
      { openingCash: 50_000, closingCash: 50_000, date },
      byDate(0, 0),
    );
    expect(r.difference).toBe(0);
    expect(r.nothingToPost).toBe(true);
  });

  it("any sales income or non-zero selisih is something to post", () => {
    const withSales = reconcileRegisterDay(
      { openingCash: 50_000, closingCash: 50_000, date },
      byDate(0, 0, 20_000),
    );
    expect(withSales.nothingToPost).toBe(false);

    const withSelisih = reconcileRegisterDay(
      { openingCash: 50_000, closingCash: 51_000, date },
      byDate(0, 0),
    );
    expect(withSelisih.nothingToPost).toBe(false);
  });

  it("an unclosed day has a null selisih", () => {
    const r = reconcileRegisterDay(
      { openingCash: 50_000, closingCash: null, date },
      byDate(150_000, 0),
    );
    expect(r.difference).toBeNull();
    expect(r.expectedClosing).toBe(200_000);
  });
});
