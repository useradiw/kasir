"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Pesanan Online</CardTitle>
      </CardHeader>
      <CardContent>
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Pencairan Diterima</p>
              <p className="text-lg font-bold text-primary tabular-nums">
                {formatRupiah(summary.disbursedRevenue)}
              </p>
              <p className="text-xs text-muted-foreground">
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
            <span className="text-xs text-muted-foreground shrink-0 group-open:hidden">
              Rincian ▾
            </span>
            <span className="text-xs text-muted-foreground shrink-0 hidden group-open:inline">
              Tutup ▴
            </span>
          </summary>
          <div className="mt-4 space-y-3">
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted-foreground text-xs">Penjualan Kotor</dt>
              <dd className="text-right tabular-nums">{formatRupiah(summary.gross)}</dd>
              <dt className="text-muted-foreground text-xs">Komisi</dt>
              <dd className="text-right text-destructive tabular-nums">
                −{formatRupiah(summary.commission)}
              </dd>
              {summary.deductions > 0 && (
                <>
                  <dt className="text-muted-foreground text-xs">Potongan Lain</dt>
                  <dd className="text-right text-destructive tabular-nums">
                    −{formatRupiah(summary.deductions)}
                  </dd>
                </>
              )}
            </dl>
            {summary.byService.length > 0 && (
              <div className="divide-y divide-foreground/5 border-t border-foreground/10 pt-2">
                {summary.byService.map((svc, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                    <span>
                      {SERVICE_LABEL[svc.service] ?? svc.service}{" "}
                      <span className="text-xs text-muted-foreground">({svc.count})</span>
                    </span>
                    <div className="text-right tabular-nums">
                      <span className="text-muted-foreground text-xs">{formatRupiah(svc.gross)}</span>
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
      </CardContent>
    </Card>
  );
}

export { SERVICE_LABEL };
