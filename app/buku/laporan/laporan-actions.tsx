"use client";

import { PeriodPicker } from "./period-picker";
import { UnduhMenu, type MonthOption } from "./unduh-menu";
import type { LaporanKeuangan } from "@/app/actions/admin/queries/laporan-keuangan-queries";

/**
 * The two header controls for /buku/laporan, grouped so the page (a server
 * component) can drop them into the topbar in one slot.
 *
 * They live in the HEADER, not the page body, because that is what the original
 * mockup specifies (docs/redesign/screens-laporan.html: the period is the
 * topbar's `.sub` line and the download is an `.icbtn` beside it). An earlier
 * version stacked a scale switch, a period chip strip and a download row above
 * the statement tabs — three rows of chrome before any number appeared.
 */
export function LaporanActions({
  laporan,
  months,
  years,
  activePeriod,
  businessName,
}: {
  laporan: LaporanKeuangan;
  months: MonthOption[];
  years: string[];
  activePeriod: string;
  businessName: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <PeriodPicker
        activePeriod={activePeriod}
        monthKeys={months.map((m) => m.month)}
        years={years}
      />
      <UnduhMenu
        laporan={laporan}
        months={months}
        years={years}
        businessName={businessName}
      />
    </div>
  );
}
