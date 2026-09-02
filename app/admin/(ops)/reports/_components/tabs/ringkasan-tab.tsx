"use client";

import { BentoCard, CardLabel } from "@/components/shell/ui";
import { RevenueBar } from "../charts/revenue-bar";
import { OnlineOrdersCard } from "../online-orders-card";
import type { ReportData } from "@/app/actions/admin/queries";
import type { Period } from "../../_utils/period-date";

export function RingkasanTab({ data, period }: { data: ReportData; period: Period }) {
  const title = period === "yearly" ? "Pendapatan per Bulan" : "Pendapatan per Hari";
  return (
    <div className="flex flex-col gap-3">
      <BentoCard>
        <CardLabel>{title}</CardLabel>
        <div className="mt-2">
          <RevenueBar data={data.revenueByDay} period={period} />
        </div>
      </BentoCard>
      <OnlineOrdersCard summary={data.onlineOrdersSummary} />
    </div>
  );
}
