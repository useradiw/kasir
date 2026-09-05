/**
 * laporan-period.ts — the reporting period for /buku/laporan.
 *
 * Laporan used to be monthly only: every caller passed "YYYY-MM" and
 * buildLaporanKeuangan called monthRange() on it. Adi asked for a yearly scale
 * too (2026-09-05), and the statement engine turned out to need nothing new —
 * incomeStatement, balanceSheet, cashFlow, changesInEquity and runValidations
 * all already take a plain dateFrom/dateTo pair. Only the period derivation was
 * month-shaped.
 *
 * The period KEY is deliberately self-describing: "2026-04" is a month and
 * "2026" is a year. That is what lets buildLaporanKeuangan keep its existing
 * one-string signature, so no existing caller or test had to change — and it is
 * also why CALK notes keep working, since they are AccountingSetting rows keyed
 * `calk:<period>:<section>` and a year is just another period there.
 *
 * Pure and client-safe on purpose (no next/headers, no prisma): the period
 * picker is a client component and imports resolvePeriod directly.
 */

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;
const YEAR_KEY = /^\d{4}$/;

export type PeriodScale = "bulan" | "tahun";

export interface LaporanPeriod {
  scale: PeriodScale;
  /** "2026-04" for a month, "2026" for a year. */
  key: string;
  dateFrom: string;
  dateTo: string;
  /** Human label: "April 2026" or "Tahun 2026". */
  label: string;
}

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** Last calendar day of a month, as a 2-digit string. Uses UTC day-0 rollover
 *  so it is not affected by the server's timezone. */
function lastDayOfMonth(year: number, month1to12: number): string {
  return String(new Date(Date.UTC(year, month1to12, 0)).getUTCDate()).padStart(2, "0");
}

export function isYearKey(key: string): boolean {
  return YEAR_KEY.test(key);
}

export function isMonthKey(key: string): boolean {
  return MONTH_KEY.test(key);
}

/**
 * Turn a period key into its date range and label. Throws on anything that is
 * neither a month nor a year: a silent fallback here would quietly report the
 * wrong period, and every caller reaches this with a validated key (the page
 * sanitises the URL parameter before calling).
 */
export function resolvePeriod(key: string): LaporanPeriod {
  if (MONTH_KEY.test(key)) {
    const [y, m] = key.split("-").map(Number) as [number, number];
    return {
      scale: "bulan",
      key,
      dateFrom: `${key}-01`,
      dateTo: `${key}-${lastDayOfMonth(y, m)}`,
      label: `${MONTH_NAMES[m - 1]} ${y}`,
    };
  }
  if (YEAR_KEY.test(key)) {
    return {
      scale: "tahun",
      key,
      dateFrom: `${key}-01-01`,
      dateTo: `${key}-12-31`,
      label: `Tahun ${key}`,
    };
  }
  throw new Error(`Periode laporan tidak valid: "${key}" (harus "YYYY-MM" atau "YYYY").`);
}

/** The year a period belongs to — "2026-04" and "2026" both give "2026". */
export function yearOf(key: string): string {
  return key.slice(0, 4);
}

/**
 * Sanitise a period key coming from the URL. Anything unrecognised falls back
 * to `fallback` rather than throwing, because a hand-edited or stale query
 * string must not 500 the page — resolvePeriod stays strict for code paths.
 */
export function periodKeyFromParam(raw: string | undefined, fallback: string): string {
  if (raw && (MONTH_KEY.test(raw) || YEAR_KEY.test(raw))) return raw;
  return fallback;
}
