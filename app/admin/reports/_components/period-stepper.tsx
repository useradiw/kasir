"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shiftDate, periodLabel, isCurrentPeriod, todayIso, type Period } from "../_utils/period-date";

export function PeriodStepper({
  period,
  date,
  onChange,
}: {
  period: Period;
  date: string;
  onChange: (next: string) => void;
}) {
  const atNow = isCurrentPeriod(period, date);
  const todayLabel: Record<Period, string> = {
    daily: "Hari ini",
    weekly: "Minggu ini",
    monthly: "Bulan ini",
    yearly: "Tahun ini",
  };
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onChange(shiftDate(period, date, -1))}
        aria-label="Sebelumnya"
      >
        <ChevronLeft />
      </Button>
      <span className="flex-1 text-center text-sm font-medium tabular-nums">
        {periodLabel(period, date)}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onChange(shiftDate(period, date, 1))}
        aria-label="Berikutnya"
      >
        <ChevronRight />
      </Button>
      {!atNow && (
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onChange(todayIso())}
          className="ml-1"
        >
          {todayLabel[period]}
        </Button>
      )}
    </div>
  );
}
