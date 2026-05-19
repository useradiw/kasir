"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueBar } from "../charts/revenue-bar";
import { OnlineOrdersCard } from "../online-orders-card";
import type { ReportData } from "@/app/actions/admin/queries";
import type { Period } from "../../_utils/period-date";

export function RingkasanTab({ data, period }: { data: ReportData; period: Period }) {
  const title = period === "yearly" ? "Pendapatan per Bulan" : "Pendapatan per Hari";
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueBar data={data.revenueByDay} period={period} />
        </CardContent>
      </Card>
      <OnlineOrdersCard summary={data.onlineOrdersSummary} />
    </div>
  );
}
