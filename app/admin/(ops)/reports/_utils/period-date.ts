export type Period = "daily" | "weekly" | "monthly" | "yearly";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTH_NAMES_FULL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function toDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function shiftDate(period: Period, dateStr: string, direction: -1 | 1): string {
  const base = toDate(dateStr);
  if (period === "daily") base.setDate(base.getDate() + direction);
  else if (period === "weekly") base.setDate(base.getDate() + direction * 7);
  else if (period === "monthly") base.setMonth(base.getMonth() + direction);
  else base.setFullYear(base.getFullYear() + direction);
  return toIso(base);
}

export function todayIso(): string {
  return toIso(new Date());
}

function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday as start
  const out = new Date(d);
  out.setDate(d.getDate() + diff);
  return out;
}

export function periodLabel(period: Period, dateStr: string): string {
  const d = toDate(dateStr);
  if (period === "daily") {
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  }
  if (period === "weekly") {
    const start = startOfWeek(d);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const sameMonth = start.getMonth() === end.getMonth();
    const startLabel = sameMonth
      ? String(start.getDate())
      : `${start.getDate()} ${MONTH_NAMES[start.getMonth()]}`;
    const endLabel = `${end.getDate()} ${MONTH_NAMES[end.getMonth()]}`;
    return `${startLabel}–${endLabel} ${end.getFullYear()}`;
  }
  if (period === "monthly") {
    return `${MONTH_NAMES_FULL[d.getMonth()]} ${d.getFullYear()}`;
  }
  return String(d.getFullYear());
}

export function isCurrentPeriod(period: Period, dateStr: string): boolean {
  const d = toDate(dateStr);
  const now = new Date();
  if (period === "daily") {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }
  if (period === "weekly") {
    const a = startOfWeek(d);
    const b = startOfWeek(now);
    return a.getTime() === b.getTime();
  }
  if (period === "monthly") {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  return d.getFullYear() === now.getFullYear();
}

export function shortDate(dateStr: string): string {
  return toDate(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function xAxisFormatter(period: Period, val: string): string {
  if (period === "yearly") {
    // val is "YYYY-MM"
    const mo = parseInt(val.split("-")[1], 10) - 1;
    return MONTH_NAMES[mo] ?? val;
  }
  return shortDate(val);
}
