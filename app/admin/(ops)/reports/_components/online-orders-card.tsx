"use client";

import { BentoCard, CardLabel } from "@/components/shell/ui";
import { formatRupiah } from "@/lib/format";
import type { ReportData } from "@/app/actions/admin/queries";

const SERVICE_LABEL: Record<string, string> = {
  GoFood: "GoFood",
  ShopeeFood: "ShopeeFood",
  GrabFood: "GrabFood",
  Take_Away: "Take Away",
  Unknown: "Lainnya",
  "Dine In": "Dine In",
};

export function OnlineOrdersCard({ summary }: { summary: ReportData["onlineOrdersSummary"] }) {
  if (summary.count === 0) return null;
  return (
    <BentoCard>
      <CardLabel>Pesanan Online</CardLabel>
      <details className="group mt-2">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11.5px] text-muted-foreground">Pencairan Diterima</p>
            <p className="font-display text-[17px] font-bold text-primary tabular-nums">
              {formatRupiah(summary.disbursedRevenue)}
            </p>
            <p className="text-[11.5px] text-muted-foreground">
              {summary.count} pesanan
              {summary.unsettledCount > 0 && (
                <>
                  {" "}
                  · {summary.unsettledCount} belum cair
                  {summary.unsettledAmount > 0 && (
                    <> ({formatRupiah(summary.unsettledAmount)})</>
                  )}
                </>
              )}
            </p>
          </div>
          <span className="shrink-0 text-[11px] font-semibold text-muted-foreground group-open:hidden">
            Rincian ▾
          </span>
          <span className="hidden shrink-0 text-[11px] font-semibold text-muted-foreground group-open:inline">
            Tutup ▴
          </span>
        </summary>
        <div className="mt-4 space-y-3">
          <dl className="grid grid-cols-2 gap-y-2 text-[12.5px]">
            <dt className="text-[11px] text-muted-foreground">Penjualan Kotor</dt>
            <dd className="text-right tabular-nums">{formatRupiah(summary.gross)}</dd>
            <dt className="text-[11px] text-muted-foreground">Komisi</dt>
            <dd className="text-right text-destructive tabular-nums">
              −{formatRupiah(summary.commission)}
            </dd>
            {summary.deductions > 0 && (
              <>
                <dt className="text-[11px] text-muted-foreground">Potongan Lain</dt>
                <dd className="text-right text-destructive tabular-nums">
                  −{formatRupiah(summary.deductions)}
                </dd>
              </>
            )}
          </dl>
          {summary.byService.length > 0 && (
            <div className="divide-y divide-border border-t border-border pt-2">
              {summary.byService.map((svc, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 text-[12.5px]">
                  <span>
                    {SERVICE_LABEL[svc.service] ?? svc.service}{" "}
                    <span className="text-[11px] text-muted-foreground">({svc.count})</span>
                  </span>
                  <div className="text-right tabular-nums">
                    <span className="text-[11px] text-muted-foreground">{formatRupiah(svc.gross)}</span>
                    {svc.disbursed > 0 && (
                      <span className="ml-2 text-primary">{formatRupiah(svc.disbursed)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>
    </BentoCard>
  );
}

export { SERVICE_LABEL };
