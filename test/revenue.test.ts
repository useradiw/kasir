import { describe, it, expect } from "vitest";
import { offlineSalesTotal, disbursedTotal, recognisedRevenue } from "@/lib/revenue";

/**
 * One definition of pendapatan for every screen (lib/revenue.ts). Beranda used
 * to sum every PAID transaction instead, which counted a GoFood order at its
 * gross value the moment it was taken — money the platform still held, minus a
 * commission that never arrives. The home screen then disagreed with both
 * /admin/reports and laporan.
 */

const tx = (totalAmount: number, service: string | null = null) => ({ totalAmount, service });

describe("offlineSalesTotal", () => {
  it("counts dine-in and takeaway sales", () => {
    expect(offlineSalesTotal([tx(50_000), tx(18_000, "Take_Away")])).toBe(68_000);
  });

  it("leaves out every online platform", () => {
    expect(
      offlineSalesTotal([
        tx(50_000),
        tx(40_000, "GoFood"),
        tx(30_000, "ShopeeFood"),
        tx(20_000, "GrabFood"),
      ]),
    ).toBe(50_000);
  });

  it("is zero for a day of nothing but platform orders", () => {
    expect(offlineSalesTotal([tx(40_000, "GoFood")])).toBe(0);
  });
});

describe("disbursedTotal", () => {
  const item = (settlementId: string, finalAmount: number) => ({
    settlementId,
    settlement: { finalAmount },
  });

  it("counts one settlement once, however many orders it covers", () => {
    expect(disbursedTotal([item("s1", 250_000), item("s1", 250_000), item("s1", 250_000)])).toBe(
      250_000,
    );
  });

  it("adds separate settlements together", () => {
    expect(disbursedTotal([item("s1", 250_000), item("s2", 90_000)])).toBe(340_000);
  });

  it("is zero when nothing has been disbursed", () => {
    expect(disbursedTotal([])).toBe(0);
  });
});

describe("recognisedRevenue", () => {
  it("is the shop's own sales plus what the platforms actually paid out", () => {
    expect(recognisedRevenue(500_000, 250_000)).toBe(750_000);
  });

  it("recognises nothing for an online order still awaiting pencairan", () => {
    // The order exists and is PAID in the till's sense, but no money has landed.
    expect(recognisedRevenue(offlineSalesTotal([tx(40_000, "GoFood")]), disbursedTotal([]))).toBe(0);
  });
});
