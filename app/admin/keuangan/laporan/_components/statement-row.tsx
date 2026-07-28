"use client";

import { formatRupiah } from "@/lib/format";

/**
 * Shared label/value row for the Laporan Keuangan statements, mirroring
 * app/admin/reports/_components/pnl-card.tsx's PnLRow. Reused across Laba
 * Rugi, Neraca, Arus Kas and Perubahan Modal so the four statements read as
 * one visual system.
 */
export function StatementRow({
  label,
  value,
  negative,
  emphasis,
  large,
  divider,
  indent,
  note,
}: {
  label: string;
  value: number;
  negative?: boolean;
  emphasis?: boolean;
  large?: boolean;
  divider?: boolean;
  /** Sub-item under a parent line (e.g. Setoran Modal under Pendanaan). */
  indent?: boolean;
  note?: string;
}) {
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  const colorClass = negative
    ? "text-destructive"
    : emphasis
      ? value < 0
        ? "text-destructive"
        : "text-primary"
      : "";
  return (
    <div className={divider ? "border-t border-foreground/10 mt-1" : ""}>
      <div className="flex items-center justify-between py-2">
        <span className={`text-sm ${indent ? "pl-4 text-muted-foreground" : ""} ${emphasis ? "font-medium" : ""}`}>
          {label}
        </span>
        <span
          className={`tabular-nums ${large ? "text-lg font-bold" : emphasis ? "font-medium" : "text-sm"} ${colorClass}`}
        >
          {sign}
          {formatRupiah(abs)}
        </span>
      </div>
      {note && <p className="text-xs text-muted-foreground -mt-1.5 pb-2">{note}</p>}
    </div>
  );
}

/** Calm zero-state notice shown at the top of a tab when the book has never
 *  been posted to — points at the setup steps instead of a wall of "Rp 0". */
export function EmptyBookNotice() {
  return (
    <div className="rounded-lg bg-warning/10 p-3 text-xs text-warning-foreground">
      Belum ada transaksi tercatat ke buku besar bulan ini, jadi semua angka di bawah
      masih Rp 0 &mdash; ini bukan berarti rusak. Pastikan dulu: isi akun default
      (Keuangan &rarr; Akun Kas), buat minimal satu akun kas, lalu atur Akun Penjualan
      (Keuangan &rarr; Akun Penjualan) untuk tunai, elektronik dan online. Setelah itu,
      tutup kas dan pencairan online akan mulai mengisi laporan ini.
    </div>
  );
}
