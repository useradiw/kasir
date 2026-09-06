/**
 * kasir-utils.test.ts — pricing math (lib/kasir-utils.ts). Pure, no DB.
 *
 * calcTotal and calcTotalFlex are two separate pricing paths into the same
 * money; the real invariant under test is that the two paths agree.
 */

import { describe, it, expect } from "vitest";
import {
  activeItems,
  calcSubtotal,
  calcItemPrice,
  calcTaxFromPct,
  calcServiceFromPct,
  calcTotal,
  calcChargeAmount,
  calcTotalFlex,
  calcChange,
} from "@/lib/kasir-utils";
import type { MenuItem, MenuVariant, OnlinePrice, OrderItem } from "@/lib/db";

const orderItem = (over: Partial<OrderItem> = {}): OrderItem => ({
  id: "oi-1",
  tableSessionId: "ts-1",
  menuItemId: "m-1",
  packageId: null,
  variantId: null,
  qty: 1,
  note: null,
  status: "SERVED",
  nameSnapshot: "Ayam Goreng",
  price: 10_000,
  splitGroup: 0,
  preparedAt: null,
  servedAt: null,
  cancelledAt: null,
  createdAt: "2026-08-30T10:00:00.000Z",
  ...over,
});

const menuItem = (over: Partial<MenuItem> = {}): MenuItem => ({
  id: "m-1",
  name: "Ayam Goreng",
  categoryId: "c-1",
  price: 20_000,
  isHidden: false,
  createdAt: "2026-08-30T10:00:00.000Z",
  updatedAt: "2026-08-30T10:00:00.000Z",
  ...over,
});

const variant = (over: Partial<MenuVariant> = {}): MenuVariant => ({
  id: "v-1",
  menuItemId: "m-1",
  label: "Pedas",
  priceModifier: 3_000,
  ...over,
});

const onlinePrice = (over: Partial<OnlinePrice> = {}): OnlinePrice => ({
  id: "op-1",
  menuItemId: "m-1",
  variantId: null,
  service: "GoFood",
  price: 25_000,
  ...over,
});

describe("activeItems", () => {
  it("drops CANCELLED items and keeps every other status", () => {
    const items = [
      orderItem({ id: "1", status: "PENDING" }),
      orderItem({ id: "2", status: "PREPARING" }),
      orderItem({ id: "3", status: "SERVED" }),
      orderItem({ id: "4", status: "CANCELLED" }),
    ];
    expect(activeItems(items).map((i) => i.id)).toEqual(["1", "2", "3"]);
  });
});

describe("calcSubtotal", () => {
  it("returns 0 for an empty list", () => {
    expect(calcSubtotal([])).toBe(0);
  });

  it("multiplies price by qty for a single item", () => {
    expect(calcSubtotal([orderItem({ price: 12_000, qty: 2 })])).toBe(24_000);
  });

  it("sums mixed quantities and excludes cancelled items", () => {
    const items = [
      orderItem({ id: "1", price: 10_000, qty: 2 }),
      orderItem({ id: "2", price: 5_000, qty: 3 }),
      orderItem({ id: "3", price: 99_000, qty: 1, status: "CANCELLED" }),
    ];
    expect(calcSubtotal(items)).toBe(35_000);
  });
});

describe("calcItemPrice", () => {
  it("returns the base price with no variant and no online prices", () => {
    expect(calcItemPrice(menuItem())).toBe(20_000);
  });

  it("adds the variant price modifier to the base price", () => {
    expect(calcItemPrice(menuItem(), variant())).toBe(23_000);
  });

  it("uses the online price for an online service with a matching null-variant price", () => {
    const prices = [onlinePrice({ variantId: null, service: "GoFood", price: 25_000 })];
    expect(calcItemPrice(menuItem(), null, "GoFood", prices)).toBe(25_000);
  });

  it("matches an online price that names the ordered variant", () => {
    const prices = [onlinePrice({ variantId: "v-1", service: "GoFood", price: 27_000 })];
    expect(calcItemPrice(menuItem(), variant(), "GoFood", prices)).toBe(27_000);
  });

  it("falls back to base + variant modifier when no online price matches the service", () => {
    const prices = [onlinePrice({ service: "GoFood", price: 25_000 })];
    expect(calcItemPrice(menuItem(), variant(), "ShopeeFood", prices)).toBe(23_000);
  });

  it("falls back to base + variant modifier when the online price is for another menu item", () => {
    const prices = [onlinePrice({ menuItemId: "m-other", price: 25_000 })];
    expect(calcItemPrice(menuItem(), variant(), "GoFood", prices)).toBe(23_000);
  });

  it("uses a Take_Away (bawa pulang) override when the session service matches", () => {
    const prices = [onlinePrice({ service: "Take_Away", price: 99_000 })];
    expect(calcItemPrice(menuItem(), null, "Take_Away", prices)).toBe(99_000);
  });

  it("falls back to base price for a service with no override", () => {
    const prices = [onlinePrice({ service: "Take_Away", price: 99_000 })];
    expect(calcItemPrice(menuItem(), null, "Unknown", prices)).toBe(20_000);
  });

  it("does not match a null-variant online price for an item ordered WITH a variant", () => {
    // The match is op.variantId === (variant?.id ?? null): a null-variant
    // price is the plain-item price and must not leak onto a variant order.
    const prices = [onlinePrice({ variantId: null, service: "GoFood", price: 25_000 })];
    expect(calcItemPrice(menuItem(), variant(), "GoFood", prices)).toBe(23_000);
  });
});

describe("calcTaxFromPct / calcServiceFromPct rounding", () => {
  it("rounds half up at a .5 boundary", () => {
    // 5 * 10% = 0.5 → 1, and 25 * 10% = 2.5 → 3 (half-up, not banker's).
    expect(calcTaxFromPct(5, 10)).toBe(1);
    expect(calcTaxFromPct(25, 10)).toBe(3);
    expect(calcServiceFromPct(5, 10)).toBe(1);
    expect(calcServiceFromPct(25, 10)).toBe(3);
  });

  it("rounds below half down and keeps whole amounts exact", () => {
    expect(calcTaxFromPct(4, 10)).toBe(0);
    expect(calcTaxFromPct(1000, 10)).toBe(100);
    expect(calcServiceFromPct(1000, 5)).toBe(50);
  });
});

describe("calcTotal", () => {
  it("adds tax and service with the default zero discount", () => {
    expect(calcTotal(10_000, 10, 5)).toBe(11_500);
  });

  it("subtracts the discount", () => {
    expect(calcTotal(10_000, 10, 5, 2_500)).toBe(9_000);
  });

  it("goes negative for a discount larger than the subtotal (no clamp)", () => {
    expect(calcTotal(5_000, 0, 0, 9_000)).toBe(-4_000);
  });

  it("uses the rounded tax component", () => {
    // 999 * 10% = 99.9 → 100.
    expect(calcTotal(999, 10, 0)).toBe(1_099);
  });
});

describe("calcChargeAmount", () => {
  it("converts pct mode against the subtotal", () => {
    expect(calcChargeAmount(2_000, { value: 10, mode: "pct" })).toBe(200);
  });

  it("rounds pct mode half up", () => {
    expect(calcChargeAmount(5, { value: 10, mode: "pct" })).toBe(1);
  });

  it("passes abs mode through unchanged", () => {
    expect(calcChargeAmount(2_000, { value: 7_777, mode: "abs" })).toBe(7_777);
  });
});

describe("calcTotalFlex vs calcTotal — two pricing paths must agree", () => {
  it("equals calcTotal when every charge is pct of the same subtotal", () => {
    // Discount: 15% of 2000 = 300, the same number calcTotal takes absolutely.
    expect(
      calcTotalFlex(2_000, { value: 10, mode: "pct" }, { value: 5, mode: "pct" }, { value: 15, mode: "pct" }),
    ).toBe(calcTotal(2_000, 10, 5, 300));
  });

  it("agrees with rounding in play and a zero discount", () => {
    // 999 * 10% = 99.9 → 100, 999 * 5% = 49.95 → 50.
    expect(
      calcTotalFlex(999, { value: 10, mode: "pct" }, { value: 5, mode: "pct" }, { value: 0, mode: "pct" }),
    ).toBe(calcTotal(999, 10, 5));
  });
});

describe("calcChange", () => {
  it("is zero for an exact payment", () => {
    expect(calcChange(50_000, 50_000)).toBe(0);
  });

  it("is positive for an overpayment", () => {
    expect(calcChange(60_000, 50_000)).toBe(10_000);
  });

  it("is negative for an underpayment", () => {
    expect(calcChange(40_000, 50_000)).toBe(-10_000);
  });
});
