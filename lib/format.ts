/** @deprecated Use `getStoreInfo()` from `@/lib/settings` for dynamic values. */
export const STORE_INFO = {
  name: "Sate Kambing Sido Mampir",
  address: "Jl. Brigjen Katamso 51, Surakarta",
  phone: "",
  instagram: "@kambingsidomampir",
} as const;

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount).replace(/\u00a0/g, " ");
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
