/**
 * day-close.test.ts — sumDaySales / isOnlineService (lib/day-close.ts).
 * Pure functions, no Prisma/pglite needed.
 */

import { describe, it, expect } from "vitest";
import { sumDaySales, isOnlineService, type DaySalesInput } from "../lib/day-close";

function tx(overrides: Partial<DaySalesInput> = {}): DaySalesInput {
  return {
    paymentMethod: "CASH",
    cashAmount: 0,
    qrisAmount: 0,
    totalAmount: 0,
    service: null,
    ...overrides,
  };
}

describe("sumDaySales", () => {
  it("sums cash-only transactions", () => {
    const totals = sumDaySales([
      tx({ paymentMethod: "CASH", totalAmount: 50_000 }),
      tx({ paymentMethod: "CASH", totalAmount: 25_000 }),
    ]);
    expect(totals).toEqual({ cashSales: 75_000, qrisSales: 0, cashTxnCount: 2 });
  });

  it("sums qris-only transactions", () => {
    const totals = sumDaySales([tx({ paymentMethod: "QRIS", totalAmount: 30_000 })]);
    expect(totals).toEqual({ cashSales: 0, qrisSales: 30_000, cashTxnCount: 0 });
  });

  it("split adds both the cash and qris legs", () => {
    const totals = sumDaySales([
      tx({ paymentMethod: "SPLIT", cashAmount: 10_000, qrisAmount: 15_000, totalAmount: 25_000 }),
    ]);
    expect(totals).toEqual({ cashSales: 10_000, qrisSales: 15_000, cashTxnCount: 1 });
  });

  it("a SPLIT transaction with no cash leg does not count as a cash transaction", () => {
    const totals = sumDaySales([
      tx({ paymentMethod: "SPLIT", cashAmount: 0, qrisAmount: 25_000, totalAmount: 25_000 }),
    ]);
    expect(totals).toEqual({ cashSales: 0, qrisSales: 25_000, cashTxnCount: 0 });
  });

  it("excludes an online-service transaction even when its method is CASH", () => {
    const totals = sumDaySales([
      tx({ paymentMethod: "CASH", totalAmount: 40_000, service: "GoFood" }),
      tx({ paymentMethod: "CASH", totalAmount: 10_000, service: null }),
    ]);
    // The GoFood leg is skipped entirely — it posts at settlement, not here.
    expect(totals).toEqual({ cashSales: 10_000, qrisSales: 0, cashTxnCount: 1 });
  });

  it("a day with a tunai sale and a GoFood sale reports only the tunai amount — counting GoFood at day close would double-book it against Income:Sales:Online", () => {
    const totals = sumDaySales([
      tx({ paymentMethod: "CASH", totalAmount: 100_000, service: null }),
      tx({ paymentMethod: "QRIS", totalAmount: 45_000, service: "GoFood" }),
    ]);
    expect(totals).toEqual({ cashSales: 100_000, qrisSales: 0, cashTxnCount: 1 });
  });

  it("excludes ShopeeFood/GrabFood transactions regardless of payment method", () => {
    const totals = sumDaySales([
      tx({ paymentMethod: "QRIS", totalAmount: 20_000, service: "ShopeeFood" }),
      tx({ paymentMethod: "SPLIT", cashAmount: 5_000, qrisAmount: 5_000, totalAmount: 10_000, service: "GrabFood" }),
    ]);
    expect(totals).toEqual({ cashSales: 0, qrisSales: 0, cashTxnCount: 0 });
  });

  it("ignores an unknown/unexpected payment method", () => {
    const totals = sumDaySales([tx({ paymentMethod: "PENDING", totalAmount: 99_000 })]);
    expect(totals).toEqual({ cashSales: 0, qrisSales: 0, cashTxnCount: 0 });
  });

  it("empty input gives zeros", () => {
    expect(sumDaySales([])).toEqual({ cashSales: 0, qrisSales: 0, cashTxnCount: 0 });
  });
});

describe("isOnlineService", () => {
  it("recognizes GoFood, ShopeeFood, GrabFood", () => {
    expect(isOnlineService("GoFood")).toBe(true);
    expect(isOnlineService("ShopeeFood")).toBe(true);
    expect(isOnlineService("GrabFood")).toBe(true);
  });

  it("returns false for null and non-online services", () => {
    expect(isOnlineService(null)).toBe(false);
    expect(isOnlineService("Take_Away")).toBe(false);
    expect(isOnlineService("Unknown")).toBe(false);
  });
});
