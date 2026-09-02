"use client";

import { Card, CardContent } from "@/components/ui/card";
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
    <Card>
      <CardContent className="py-2 space-y-1">
        <p className="text-sm text-muted-foreground">Pendapatan</p>
        <p className="text-3xl font-bold tabular-nums">{formatRupiah(total)}</p>
        <p className="text-sm text-muted-foreground tabular-nums">
          {count} transaksi
          {count > 0 && <> · rata {formatRupiah(average)}</>}
        </p>
      </CardContent>
    </Card>
  );
}
