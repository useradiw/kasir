"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah } from "@/lib/format";
import { PaymentMethodBars } from "../charts/payment-method-bars";
import { useChartColors } from "../charts/use-chart-colors";
import { SERVICE_LABEL } from "../online-orders-card";
import type { ReportData } from "@/app/actions/admin/queries";

export function PenjualanTab({ data }: { data: ReportData }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Metode Pembayaran</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentMethodBars data={data.paymentMethods} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Item Terlaris</CardTitle>
        </CardHeader>
        <CardContent>
          {data.topItems.length > 0 ? (
            <div className="divide-y divide-foreground/5">
              {data.topItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <span className="text-sm truncate pr-3">{item.name}</span>
                  <div className="text-right text-sm shrink-0 tabular-nums">
                    <span className="text-muted-foreground">{item.qty}×</span>
                    <span className="ml-2 font-medium">{formatRupiah(item.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Tidak ada data.</p>
          )}
        </CardContent>
      </Card>

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
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Channel Layanan</CardTitle>
      </CardHeader>
      <CardContent>
        {channels.length > 0 ? (
          <div className="space-y-2">
            {channels.map((ch, i) => (
              <div
                key={i}
                className="flex items-stretch gap-3 rounded-lg border border-border bg-input/20 p-3"
              >
                <div
                  className="w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: colors[i % colors.length] }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">
                      {SERVICE_LABEL[ch.service] ?? ch.service}
                    </span>
                    <span className="text-sm font-medium tabular-nums">
                      {formatRupiah(ch.netAmount)}
                    </span>
                  </div>
                  {ch.commission > 0 && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-0.5 tabular-nums">
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
          <p className="text-sm text-muted-foreground py-8 text-center">Tidak ada data.</p>
        )}
      </CardContent>
    </Card>
  );
}
