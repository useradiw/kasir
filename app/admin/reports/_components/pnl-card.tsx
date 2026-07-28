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
        {showCogs && <PnLRow label="HPP (dari pengeluaran bahan baku)" value={-data.cogs} negative />}
        {showCogs && (
          <PnLRow
            label="Laba Kotor"
            value={data.grossProfit}
            extra={data.grossMarginPct !== null ? `${data.grossMarginPct}%` : undefined}
            divider
            emphasis
          />
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
        {/* Gaji sits BELOW Laba Bersih, without a minus sign, deliberately: it is
            NOT part of the arithmetic above. Showing it as "−Rp x" inside the
            deduction chain made the column fail to add up (Laba Kotor − Gaji −
            Pengeluaran did not equal Laba Bersih), which reads as a bug. It is an
            estimate from Staff.salary x hari hadir; real gaji reaches laba bersih
            only when recorded as a pengeluaran, via the ledger. */}
        {data.totalSalary > 0 && (
          <PnLRow
            label="Gaji (estimasi, di luar hitungan)"
            value={data.totalSalary}
            divider
            note="Perkiraan dari gaji harian x hari hadir — bukan dari buku besar, jadi TIDAK dikurangkan dari laba bersih di atas. Catat gaji sebagai pengeluaran agar ikut terhitung."
          />
        )}
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
  note,
}: {
  label: string;
  value: number;
  extra?: string;
  negative?: boolean;
  emphasis?: boolean;
  large?: boolean;
  divider?: boolean;
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
        <span className={`text-sm ${emphasis ? "font-medium" : ""}`}>{label}</span>
        <span className={`tabular-nums ${large ? "text-lg font-bold" : emphasis ? "font-medium" : "text-sm"} ${colorClass}`}>
          {sign}
          {formatRupiah(abs)}
          {extra && <span className="ml-2 text-xs text-muted-foreground font-normal">{extra}</span>}
        </span>
      </div>
      {note && <p className="text-xs text-muted-foreground -mt-1.5 pb-2">{note}</p>}
    </div>
  );
}
