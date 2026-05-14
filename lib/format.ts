export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  // Replace all Unicode whitespace variants (U+00A0 non-breaking, U+202F narrow no-break)
  // that differ between Node.js ICU and Chrome's Intl implementation.
  }).format(amount).replace(/[\u00a0\u202f\u2009\u2007]/g, " ");
}

export function formatDateTime(
  date: string | Date,
  dateStyle: "short" | "medium" | "long" = "short"
): string {
  return new Date(date).toLocaleString("id-ID", {
    dateStyle,
    timeStyle: "short",
  });
}

export function formatPaymentMethod(method: string): string {
  if (method === "CASH") return "Tunai";
  if (method === "QRIS") return "QRIS";
  if (method === "SPLIT") return "Split";
  if (method === "PENDING") return "Unsettled";
  return method;
}

/** YYYY-MM-DD key in the server's local timezone. Use this for day-bucketing
 *  CashRegister.date (stored as local midnight) against transaction.paidAt /
 *  expense.recordedAt — `.toISOString()` would bucket in UTC and split days. */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
