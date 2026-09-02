"use client";

import { BentoCard, CardLabel } from "@/components/shell/ui";
import { formatRupiah } from "@/lib/format";
import type { ReportData } from "@/app/actions/admin/queries";

export function PnLCard({ data }: { data: ReportData }) {
  const showCogs = data.cogs > 0;
  return (
    <BentoCard className="flex flex-col gap-0.5">
      <CardLabel>Profitabilitas</CardLabel>
      <div className="mt-1 flex flex-col">
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
      </div>
    </BentoCard>
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
    <div className={divider ? "mt-1 border-t border-border" : ""}>
      <div className="flex items-center justify-between py-2">
        <span className={`text-[12.5px] ${emphasis ? "font-bold" : "font-semibold"}`}>{label}</span>
        <span className={`tabular-nums ${large ? "font-display text-[17px] font-bold" : emphasis ? "text-[13px] font-bold" : "text-[12.5px] font-semibold"} ${colorClass}`}>
          {sign}
          {formatRupiah(abs)}
          {extra && <span className="ml-2 text-[11px] font-normal text-muted-foreground">{extra}</span>}
        </span>
      </div>
      {note && <p className="-mt-1.5 pb-2 text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}
