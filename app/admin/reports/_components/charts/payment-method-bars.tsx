"use client";

import { formatRupiah } from "@/lib/format";
import { METHOD_LABEL } from "../../_utils/export";
import { useChartColors } from "./use-chart-colors";

export function PaymentMethodBars({
  data,
}: {
  data: Array<{ method: string; amount: number; count: number }>;
}) {
  const colors = useChartColors(Math.max(data.length, 1));
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Tidak ada data.</p>;
  }
  const max = data.reduce((m, d) => Math.max(m, d.amount), 0) || 1;
  return (
    <div className="space-y-3">
      {data.map((p, i) => {
        const pct = Math.round((p.amount / max) * 100);
        return (
          <div key={p.method} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{METHOD_LABEL[p.method] ?? p.method}</span>
              <span className="tabular-nums">
                {formatRupiah(p.amount)}{" "}
                <span className="text-muted-foreground text-xs">· {p.count}</span>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
