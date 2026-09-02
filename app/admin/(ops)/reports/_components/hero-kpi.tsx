"use client";

import { MoneyHero } from "@/components/shell/ui";
import { formatRupiah } from "@/lib/format";

export function HeroKpi({
  total,
  count,
  average,
}: {
  total: number;
  count: number;
  average: number;
}) {
  return (
    <MoneyHero
      label="Pendapatan"
      value={formatRupiah(total)}
      sub={
        <span className="tabular-nums">
          {count} transaksi
          {count > 0 && <> · rata {formatRupiah(average)}</>}
        </span>
      }
      className="rounded-2xl border border-border bg-card p-4 shadow-sm"
    />
  );
}
