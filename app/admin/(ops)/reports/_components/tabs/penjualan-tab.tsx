"use client";

import { BentoCard, CardLabel } from "@/components/shell/ui";
import { formatRupiah } from "@/lib/format";
import { PaymentMethodBars } from "../charts/payment-method-bars";
import { useChartColors } from "../charts/use-chart-colors";
import { SERVICE_LABEL } from "../online-orders-card";
import type { ReportData } from "@/app/actions/admin/queries";

export function PenjualanTab({ data }: { data: ReportData }) {
  return (
    <div className="flex flex-col gap-3">
      <BentoCard>
        <CardLabel>Metode Pembayaran</CardLabel>
        <div className="mt-3">
          <PaymentMethodBars data={data.paymentMethods} />
        </div>
      </BentoCard>

      <BentoCard>
        <CardLabel>Item Terlaris</CardLabel>
        {data.topItems.length > 0 ? (
          <div className="mt-1 divide-y divide-border">
            {data.topItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <span className="truncate pr-3 text-[12.5px] font-semibold">{item.name}</span>
                <div className="shrink-0 text-right text-[12.5px] tabular-nums">
                  <span className="text-muted-foreground">{item.qty}×</span>
                  <span className="ml-2 font-bold">{formatRupiah(item.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-[12.5px] font-semibold text-muted-foreground">Tidak ada data.</p>
        )}
      </BentoCard>

      <ChannelsCard channels={data.serviceChannels} />
    </div>
  );
}

function ChannelsCard({
  channels,
}: {
  channels: ReportData["serviceChannels"];
}) {
  const colors = useChartColors(Math.max(channels.length, 1));
  return (
    <BentoCard>
      <CardLabel>Channel Layanan</CardLabel>
      {channels.length > 0 ? (
        <div className="mt-2 flex flex-col gap-2">
          {channels.map((ch, i) => (
            <div
              key={i}
              className="flex items-stretch gap-3 rounded-xl border border-border bg-card-2 p-3"
            >
              <div
                className="w-1 shrink-0 rounded-full"
                style={{ backgroundColor: colors[i % colors.length] }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12.5px] font-bold">
                    {SERVICE_LABEL[ch.service] ?? ch.service}
                  </span>
                  <span className="text-[12.5px] font-bold tabular-nums">
                    {formatRupiah(ch.netAmount)}
                  </span>
                </div>
                {ch.commission > 0 && (
                  <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                    <span>Kotor: {formatRupiah(ch.amount)}</span>
                    <span className="text-destructive">
                      −{formatRupiah(ch.commission)} komisi
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-8 text-center text-[12.5px] font-semibold text-muted-foreground">Tidak ada data.</p>
      )}
    </BentoCard>
  );
}
