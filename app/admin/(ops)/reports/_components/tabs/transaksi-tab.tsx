"use client";

import { BentoCard, CardLabel, Tag } from "@/components/shell/ui";
import { formatRupiah } from "@/lib/format";
import { METHOD_LABEL } from "../../_utils/export";
import type { ReportData } from "@/app/actions/admin/queries";

export function TransaksiTab({ data }: { data: ReportData }) {
  return (
    <div className="flex flex-col gap-3">
      <BentoCard>
        <CardLabel>
          Detail Transaksi{" "}
          <span className="font-normal normal-case tracking-normal text-muted-foreground">
            ({data.transactions.length})
          </span>
        </CardLabel>
        {data.transactions.length > 0 ? (
          <div className="mt-1 divide-y divide-border">
            {data.transactions.map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-bold">{t.sessionName}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {new Date(t.paidAt).toLocaleString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "numeric",
                      month: "short",
                    })}
                    {t.processedBy && <> · {t.processedBy}</>}
                  </p>
                </div>
                <div className="shrink-0 space-y-0.5 text-right">
                  <p className="text-[12.5px] font-bold tabular-nums">
                    {formatRupiah(t.totalAmount)}
                  </p>
                  <Tag tone="acc">{METHOD_LABEL[t.paymentMethod] ?? t.paymentMethod}</Tag>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-[12.5px] font-semibold text-muted-foreground">
            Tidak ada transaksi.
          </p>
        )}
      </BentoCard>
      {data.voidedCount > 0 && (
        <p className="text-center text-[11px] text-muted-foreground">
          {data.voidedCount} transaksi void tidak termasuk dalam perhitungan.
        </p>
      )}
    </div>
  );
}
