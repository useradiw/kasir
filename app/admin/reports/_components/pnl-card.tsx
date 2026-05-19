"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah } from "@/lib/format";
import type { ReportData } from "@/app/actions/admin/queries";

export function PnLCard({ data }: { data: ReportData }) {
  const showCogs = data.cogs > 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Profitabilitas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        <PnLRow label="Pendapatan" value={data.revenue.total} />
        {showCogs && <PnLRow label="HPP" value={-data.cogs} negative />}
        {showCogs && (
          <PnLRow
            label="Laba Kotor"
            value={data.grossProfit}
            extra={data.grossMarginPct !== null ? `${data.grossMarginPct}%` : undefined}
            divider
            emphasis
          />
        )}
        {data.totalSalary > 0 && (
          <PnLRow label="Gaji Karyawan" value={-data.totalSalary} negative />
        )}
        {data.totalExpenses > 0 && (
          <PnLRow label="Pengeluaran" value={-data.totalExpenses} negative />
        )}
        <PnLRow
          label="Laba Bersih"
          value={data.netProfit}
          divider
          emphasis
          large
        />
      </CardContent>
    </Card>
  );
}

function PnLRow({
  label,
  value,
  extra,
  negative,
  emphasis,
  large,
  divider,
}: {
  label: string;
  value: number;
  extra?: string;
  negative?: boolean;
  emphasis?: boolean;
  large?: boolean;
  divider?: boolean;
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
    <div
      className={`flex items-center justify-between py-2 ${divider ? "border-t border-foreground/10 mt-1 pt-2" : ""}`}
    >
      <span className={`text-sm ${emphasis ? "font-medium" : ""}`}>{label}</span>
      <span className={`tabular-nums ${large ? "text-lg font-bold" : emphasis ? "font-medium" : "text-sm"} ${colorClass}`}>
        {sign}
        {formatRupiah(abs)}
        {extra && <span className="ml-2 text-xs text-muted-foreground font-normal">{extra}</span>}
      </span>
    </div>
  );
}
