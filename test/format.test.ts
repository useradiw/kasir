/**
 * format.test.ts — display formatting (lib/format.ts). Pure, no DB.
 *
 * localDateKey decides which local calendar day a sale belongs to (day-bucketing
 * CashRegister.date against paidAt), so it is pinned at BOTH local midnight
 * edges: just after midnight and just before midnight. On a UTC+7 server (this
 * deployment) the just-after-midnight edge is the one where toISOString() would
 * misfile the sale to the previous UTC day; the late-evening edge catches the
 * same regression on negative-offset machines.
 */

import { describe, it, expect } from "vitest";
import {
  formatRupiah,
  formatRpPerUnit,
  formatPaymentMethod,
  formatTransactionShortId,
  localDateKey,
  formatMonth,
} from "@/lib/format";

describe("formatRupiah", () => {
  it("formats zero without decimals", () => {
    expect(formatRupiah(0)).toBe("Rp 0");
  });

  it("formats negatives with a leading minus", () => {
    expect(formatRupiah(-5000)).toBe("-Rp 5.000");
  });

  it("formats thousands with Indonesian separators", () => {
    expect(formatRupiah(1_500_000)).toBe("Rp 1.500.000");
  });
});

describe("formatRpPerUnit", () => {
  it("shows whole rupiah above 100", () => {
    expect(formatRpPerUnit(150)).toBe("Rp 150");
  });

  it("keeps two decimals for small values", () => {
    expect(formatRpPerUnit(12.345)).toBe("Rp 12,35");
  });

  it("keeps three decimals so sub-rupiah costs do not render as Rp 0", () => {
    expect(formatRpPerUnit(0.03)).toBe("Rp 0,03");
  });

  it("renders non-finite input as Rp 0", () => {
    expect(formatRpPerUnit(Infinity)).toBe("Rp 0");
    expect(formatRpPerUnit(NaN)).toBe("Rp 0");
  });
});

describe("formatPaymentMethod", () => {
  it("maps every known method", () => {
    expect(formatPaymentMethod("CASH")).toBe("Tunai");
    expect(formatPaymentMethod("QRIS")).toBe("QRIS");
    expect(formatPaymentMethod("SPLIT")).toBe("Split");
    expect(formatPaymentMethod("PENDING")).toBe("Unsettled");
  });

  it("passes an unknown method through unchanged", () => {
    expect(formatPaymentMethod("TELEPATHY")).toBe("TELEPATHY");
  });
});

describe("formatTransactionShortId", () => {
  it("takes the first 8 hex chars, uppercased, prefixed with #", () => {
    expect(formatTransactionShortId("a1b2c3d4-e5f6-4789-a012-3456789abcde")).toBe("#A1B2C3D4");
  });

  it("is deterministic for the same id", () => {
    const id = "0f9e8d7c-1111-2222-3333-444455556666";
    expect(formatTransactionShortId(id)).toBe(formatTransactionShortId(id));
  });
});

describe("localDateKey — the local calendar date, never UTC", () => {
  it("keeps a sale just after local midnight on its own day", () => {
    // 00:30 on 1 Sep local is 17:30 on 31 Aug UTC (UTC+7): toISOString() would
    // misfile this sale into the previous month.
    const d = new Date(2026, 8, 1, 0, 30, 0, 0);
    expect(localDateKey(d)).toBe("2026-09-01");
  });

  it("keeps a late-evening sale on its own day", () => {
    const d = new Date(2026, 7, 30, 23, 59, 0, 0);
    expect(localDateKey(d)).toBe("2026-08-30");
  });

  it("zero-pads month and day", () => {
    const d = new Date(2026, 2, 5, 12, 0, 0, 0); // 5 Mar 2026, midday
    expect(localDateKey(d)).toBe("2026-03-05");
  });
});

describe("formatMonth", () => {
  it("renders the Indonesian month name and year", () => {
    expect(formatMonth("2026-04")).toBe("April 2026");
    expect(formatMonth("2026-01")).toBe("Januari 2026");
    expect(formatMonth("2026-12")).toBe("Desember 2026");
  });

  it("falls back to the raw string rather than printing undefined", () => {
    // The laporan month picker feeds this straight from the DB, so a bad row
    // must degrade to something readable instead of "undefined 2026".
    expect(formatMonth("2026-13")).toBe("2026-13");
    expect(formatMonth("bukan-bulan")).toBe("bukan-bulan");
  });
});
