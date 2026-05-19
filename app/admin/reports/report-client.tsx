"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ReportData } from "@/app/actions/admin/queries";
import { ReportHeader } from "./_components/report-header";
import { HeroKpi } from "./_components/hero-kpi";
import { PnLCard } from "./_components/pnl-card";
import { Segmented } from "./_components/segmented";
import { RingkasanTab } from "./_components/tabs/ringkasan-tab";
import { PenjualanTab } from "./_components/tabs/penjualan-tab";
import { OperasionalTab } from "./_components/tabs/operasional-tab";
import { TransaksiTab } from "./_components/tabs/transaksi-tab";
import { periodLabel, type Period } from "./_utils/period-date";
import { downloadCSV, downloadPDF } from "./_utils/export";

type TabKey = "summary" | "sales" | "ops" | "txn";

export function ReportClient({
  data,
  currentPeriod,
  currentDate,
  isOwner = true,
}: {
  data: ReportData;
  currentPeriod: Period;
  currentDate: string;
  isOwner?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("summary");
  const [isRefreshing, startRefresh] = useTransition();

  const navigate = (period: Period, date: string) =>
    router.push(`/admin/reports?period=${period}&date=${date}`);

  const dateRangeLabel = periodLabel(currentPeriod, currentDate);

  const tabs: ReadonlyArray<{ value: TabKey; label: string }> = [
    { value: "summary", label: "Ringkasan" },
    { value: "sales", label: "Penjualan" },
    { value: "ops", label: "Operasional" },
    ...(isOwner ? ([{ value: "txn", label: "Transaksi" }] as const) : []),
  ];

  return (
    <div className="space-y-6">
      <ReportHeader
        period={currentPeriod}
        date={currentDate}
        onPeriodChange={(p) => navigate(p, currentDate)}
        onDateChange={(d) => navigate(currentPeriod, d)}
        onRefresh={() => startRefresh(() => router.refresh())}
        isRefreshing={isRefreshing}
        onExportCSV={
          isOwner ? () => downloadCSV(data, currentPeriod, currentDate, dateRangeLabel) : undefined
        }
        onExportPDF={
          isOwner ? () => downloadPDF(data, currentPeriod, dateRangeLabel) : undefined
        }
      />

      <HeroKpi
        total={data.revenue.total}
        count={data.revenue.count}
        average={data.revenue.average}
      />

      {isOwner && <PnLCard data={data} />}

      <Segmented<TabKey> value={tab} onChange={setTab} options={tabs} />

      {tab === "summary" && <RingkasanTab data={data} period={currentPeriod} />}
      {tab === "sales" && <PenjualanTab data={data} />}
      {tab === "ops" && <OperasionalTab data={data} isOwner={isOwner} />}
      {tab === "txn" && isOwner && <TransaksiTab data={data} />}
    </div>
  );
}
