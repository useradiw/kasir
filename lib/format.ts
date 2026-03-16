export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
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
