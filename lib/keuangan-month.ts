import { cookies } from "next/headers";

const COOKIE = "wb_month";
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Current month as "YYYY-MM" (local time). */
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * The active accounting month for the Keuangan area, from the `wb_month` cookie
 * set by the month picker. Falls back to the current month when unset/invalid.
 * Read-only — the picker's server action sets the cookie.
 */
export async function getSelectedMonth(): Promise<string> {
  const store = await cookies();
  const v = store.get(COOKIE)?.value;
  return v && MONTH_RE.test(v) ? v : currentMonth();
}

export const SELECTED_MONTH_COOKIE = COOKIE;

/** First/last day of a "YYYY-MM" month (defaults to the current month). Plain
 *  sync helper — kept out of the "use server" queries file since every export
 *  there must be an async server action. */
export function monthRange(month?: string): { dateFrom: string; dateTo: string; month: string } {
  const now = new Date();
  const m = month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [y, mo] = m.split("-").map(Number);
  const last = new Date(Date.UTC(y!, mo!, 0)).getUTCDate();
  return { dateFrom: `${m}-01`, dateTo: `${m}-${String(last).padStart(2, "0")}`, month: m };
}

