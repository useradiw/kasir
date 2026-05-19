"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah } from "@/lib/format";
import { METHOD_LABEL } from "../../_utils/export";
import type { ReportData } from "@/app/actions/admin/queries";

export function TransaksiTab({ data }: { data: ReportData }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Detail Transaksi{" "}
            <span className="text-muted-foreground font-normal">
              ({data.transactions.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.transactions.length > 0 ? (
            <div className="divide-y divide-foreground/5">
              {data.transactions.map((t) => (
                <div key={t.id} className="flex items-start justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.sessionName}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {new Date(t.paidAt).toLocaleString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "numeric",
                        month: "short",
                      })}
                      {t.processedBy && <> · {t.processedBy}</>}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-sm font-medium tabular-nums">
                      {formatRupiah(t.totalAmount)}
                    </p>
                    <span className="inline-block rounded-full px-2 py-0.5 text-xs bg-primary/10 text-primary">
                      {METHOD_LABEL[t.paymentMethod] ?? t.paymentMethod}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Tidak ada transaksi.
            </p>
          )}
        </CardContent>
      </Card>
      {data.voidedCount > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {data.voidedCount} transaksi void tidak termasuk dalam perhitungan.
        </p>
      )}
    </div>
  );
}
