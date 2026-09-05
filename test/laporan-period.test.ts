/**
 * laporan-period.test.ts — the month/year period keys behind /buku/laporan.
 *
 * Added 2026-09-05 with the yearly scale. The date bounds matter more than
 * they look: buildLaporanKeuangan feeds dateFrom/dateTo straight into the
 * statement engine, so an off-by-one at a month end silently moves a day's
 * takings into the wrong period, and February is the case a naive
 * "30 days" or "same day next month" implementation gets wrong.
 */

import { describe, it, expect } from "vitest";
import {
  resolvePeriod,
  periodKeyFromParam,
  isMonthKey,
  isYearKey,
  yearOf,
} from "@/lib/laporan-period";

describe("resolvePeriod — months", () => {
  it("spans the whole month and labels it in Indonesian", () => {
    const p = resolvePeriod("2026-04");
    expect(p).toMatchObject({
      scale: "bulan",
      key: "2026-04",
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
      label: "April 2026",
    });
  });

  it("gets 31-day and 30-day months right", () => {
    expect(resolvePeriod("2026-01").dateTo).toBe("2026-01-31");
    expect(resolvePeriod("2026-09").dateTo).toBe("2026-09-30");
    expect(resolvePeriod("2026-12").dateTo).toBe("2026-12-31");
  });

  it("gets February right in both common and leap years", () => {
    expect(resolvePeriod("2026-02").dateTo).toBe("2026-02-28");
    expect(resolvePeriod("2028-02").dateTo).toBe("2028-02-29");
    expect(resolvePeriod("2000-02").dateTo).toBe("2000-02-29"); // divisible by 400
    expect(resolvePeriod("1900-02").dateTo).toBe("1900-02-28"); // divisible by 100, not 400
  });
});

describe("resolvePeriod — years", () => {
  it("spans 1 January to 31 December", () => {
    expect(resolvePeriod("2026")).toMatchObject({
      scale: "tahun",
      key: "2026",
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
      label: "Tahun 2026",
    });
  });
});

describe("resolvePeriod — rejection", () => {
  it("throws rather than guessing at a key it does not understand", () => {
    // A silent fallback here would report a DIFFERENT period than the one
    // asked for, with nothing on screen saying so.
    for (const bad of ["2026-13", "2026-00", "26-04", "2026-4", "", "bulan-ini"]) {
      expect(() => resolvePeriod(bad), `should reject ${bad}`).toThrow();
    }
  });
});

describe("periodKeyFromParam", () => {
  it("accepts valid month and year keys from the URL", () => {
    expect(periodKeyFromParam("2026-04", "2026-09")).toBe("2026-04");
    expect(periodKeyFromParam("2026", "2026-09")).toBe("2026");
  });

  it("falls back instead of throwing, so a stale URL cannot 500 the page", () => {
    expect(periodKeyFromParam(undefined, "2026-09")).toBe("2026-09");
    expect(periodKeyFromParam("2026-13", "2026-09")).toBe("2026-09");
    expect(periodKeyFromParam("../etc", "2026-09")).toBe("2026-09");
  });
});

describe("key helpers", () => {
  it("tells months and years apart", () => {
    expect(isMonthKey("2026-04")).toBe(true);
    expect(isMonthKey("2026")).toBe(false);
    expect(isYearKey("2026")).toBe(true);
    expect(isYearKey("2026-04")).toBe(false);
  });

  it("reads the year off either kind of key", () => {
    expect(yearOf("2026-04")).toBe("2026");
    expect(yearOf("2026")).toBe("2026");
  });
});
