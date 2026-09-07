"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/shell/sheet";
import { Tag } from "@/components/shell/ui";
import { exportCSV } from "@/lib/export-csv";
import { exportXLSX } from "@/lib/export-xlsx";
import { buildLaporanSections } from "@/lib/laporan-csv";
import { buildLaporanWorkbook } from "@/lib/laporan-xlsx";
import { resolvePeriod } from "@/lib/laporan-period";
import { notify } from "@/lib/notify";
import {
  getLaporanKeuangan,
  type LaporanKeuangan,
} from "@/app/actions/admin/queries/laporan-keuangan-queries";

export type MonthOption = { month: string; locked: boolean };

/**
 * The Unduh control: any period, in either format.
 *
 * XLSX is a faithful copy of the Warung Books workbook Adi has read for months
 * (lib/laporan-xlsx.ts carries the styling spec, verified cell-by-cell against
 * the real file). CSV stays because it emits RAW numbers, which is what you
 * want when the file feeds a spreadsheet formula rather than being read.
 *
 * The period on screen is exported straight from props with no round trip; the
 * others are fetched one at a time through getLaporanKeuangan, which carries
 * the same requireCan("buku.read") gate as every other query in that module.
 */
export function UnduhMenu({
  laporan,
  months,
  years,
  businessName,
}: {
  laporan: LaporanKeuangan;
  months: MonthOption[];
  years: string[];
  businessName: string;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  // Which period is being prepared. A single boolean would disable the whole
  // list and hide which row the owner is actually waiting on.
  const [busy, setBusy] = useState<string | null>(null);

  function write(target: LaporanKeuangan) {
    if (format === "xlsx") {
      exportXLSX(
        `Laporan Keuangan ${target.period.label}.xlsx`,
        buildLaporanWorkbook(target, businessName),
      ).catch(notify.error);
    } else {
      exportCSV(`laporan-keuangan-${target.month}.csv`, buildLaporanSections(target));
    }
  }

  // Months first, then whole years — the common case is one month.
  const options = [
    ...months.map((m) => ({ key: m.month, label: resolvePeriod(m.month).label })),
    ...years.map((y) => ({ key: y, label: `Tahun ${y}` })),
  ];
  const listed = options.some((o) => o.key === laporan.month)
    ? options
    : [{ key: laporan.month, label: laporan.period.label }, ...options];

  async function download(periodKey: string) {
    if (busy) return;
    if (periodKey === laporan.month) {
      write(laporan);
      setOpen(false);
      return;
    }
    setBusy(periodKey);
    try {
      write(await getLaporanKeuangan(periodKey));
      setOpen(false);
    } catch (e) {
      // Never swallow. A silent no-op looks exactly like the browser blocking
      // the download, and the owner would sit there retrying.
      notify.error(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="icon-lg"
        aria-label="Unduh laporan"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">⬇</span>
      </Button>

      {open ? (
        <>
          {/* Tap anywhere else to dismiss. */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-60 rounded-2xl border border-border bg-popover p-1.5 shadow-lg"
          >
            <div className="px-1 pb-1.5">
              <Segmented
                options={[
                  { value: "xlsx" as const, label: "Excel" },
                  { value: "csv" as const, label: "CSV" },
                ]}
                value={format}
                onChange={setFormat}
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {listed.map((o) => (
                <Button
                  key={o.key}
                  variant="ghost"
                  role="menuitem"
                  disabled={busy !== null}
                  onClick={() => void download(o.key)}
                  className="h-11 w-full justify-start px-2.5 text-[12.5px] font-bold"
                >
                  <span className="flex-1 text-left">{o.label}</span>
                  {o.key === laporan.month ? <Tag tone="ok">Aktif</Tag> : null}
                  {busy === o.key ? (
                    <span className="text-[11px] font-semibold text-muted-foreground">…</span>
                  ) : null}
                </Button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
