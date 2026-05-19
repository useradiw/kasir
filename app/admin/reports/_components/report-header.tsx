"use client";

import { useState, useRef, useEffect } from "react";
import { RefreshCw, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/ui";
import { Segmented } from "./segmented";
import { PeriodStepper } from "./period-stepper";
import type { Period } from "../_utils/period-date";

const PERIOD_OPTIONS: ReadonlyArray<{ value: Period; label: string }> = [
  { value: "daily", label: "Harian" },
  { value: "weekly", label: "Mingguan" },
  { value: "monthly", label: "Bulanan" },
  { value: "yearly", label: "Tahunan" },
];

export function ReportHeader({
  period,
  date,
  onPeriodChange,
  onDateChange,
  onRefresh,
  isRefreshing,
  onExportCSV,
  onExportPDF,
}: {
  period: Period;
  date: string;
  onPeriodChange: (p: Period) => void;
  onDateChange: (d: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
}) {
  const showMenu = Boolean(onExportCSV || onExportPDF);

  return (
    <div className="space-y-3">
      <AdminPageHeader title="Laporan">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Muat ulang"
            title="Muat ulang"
          >
            <RefreshCw className={isRefreshing ? "animate-spin" : ""} />
          </Button>
          {showMenu && <KebabMenu onCSV={onExportCSV} onPDF={onExportPDF} />}
        </div>
      </AdminPageHeader>
      <Segmented<Period> value={period} onChange={onPeriodChange} options={PERIOD_OPTIONS} />
      <PeriodStepper period={period} date={date} onChange={onDateChange} />
    </div>
  );
}

function KebabMenu({ onCSV, onPDF }: { onCSV?: () => void; onPDF?: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Aksi lainnya"
      >
        <MoreVertical />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-32 rounded-xl border border-border bg-popover p-1 text-sm shadow-md"
        >
          {onCSV && (
            <button
              role="menuitem"
              className="block w-full rounded-lg px-3 py-2 text-left hover:bg-muted"
              onClick={() => {
                setOpen(false);
                onCSV();
              }}
            >
              Ekspor CSV
            </button>
          )}
          {onPDF && (
            <button
              role="menuitem"
              className="block w-full rounded-lg px-3 py-2 text-left hover:bg-muted"
              onClick={() => {
                setOpen(false);
                onPDF();
              }}
            >
              Ekspor PDF
            </button>
          )}
        </div>
      )}
    </div>
  );
}
