"use client";

import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";

/**
 * StatementRow — reskin of app/admin/keuangan/laporan/_components/
 * statement-row.tsx on the new design system. Same props, same total/
 * grand-total distinction (`emphasis` for a subtotal, `large` added on top
 * for the statement's one headline figure) — only the classes changed. The
 * mockup's `fcard` / `frow` / `frow total` / `frow grand` structure
 * (docs/redesign/screens-laporan.html) maps onto BentoCard (the fcard) plus
 * this row (frow), with `divider` reproducing the mockup's border-top on a
 * subtotal and `large` its bigger bold grand-total figure.
 *
 * Every one of the six tabs renders its figures through this one component,
 * so there is one place that decides what a total row looks like.
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
    <div className={divider ? "mt-1 border-t border-border pt-1" : ""}>
      <div className="flex items-center justify-between py-1.5">
        <span
          className={cn(
            "text-[12.5px] font-semibold",
            indent && "pl-3 text-muted-foreground",
            emphasis && "font-bold text-foreground",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "tabular-nums font-bold",
            large ? "text-[16px]" : "text-[12.5px]",
            colorClass,
          )}
        >
          {sign}
          {formatRupiah(abs)}
        </span>
      </div>
      {note && <p className="-mt-1 pb-1.5 text-[11px] font-semibold text-muted-foreground">{note}</p>}
    </div>
  );
}

/** Calm zero-state notice shown at the top of a tab when the book has never
 *  been posted to — points at the setup screens instead of a wall of "Rp 0".
 *  Same copy as the old EmptyBookNotice, with the /buku route names. */
export function EmptyBookNotice() {
  return (
    <div className="rounded-2xl border border-warning/35 bg-warning-soft p-3.5 text-[12px] font-semibold text-warning-foreground">
      Belum ada transaksi tercatat ke buku besar bulan ini, jadi semua angka di bawah masih Rp 0
      — ini bukan berarti rusak. Pastikan dulu: isi akun default (Buku → Akun Kas), buat minimal
      satu akun kas, lalu atur Akun Penjualan (Buku → Akun Penjualan) untuk tunai, elektronik dan
      online. Setelah itu, tutup kas dan pencairan online akan mulai mengisi laporan ini.
    </div>
  );
}
