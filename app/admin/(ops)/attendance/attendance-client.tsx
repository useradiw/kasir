"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BentoCard, CardLabel, Row } from "@/components/shell/ui";
import { RoleBadge } from "@/components/shared/badge";
import { useAdminAction } from "@/hooks/use-admin-action";
import { markAttendance, bulkMarkAttendance } from "@/app/actions/admin/attendance";

type StaffAttendance = {
  staffId: string;
  staffName: string;
  role: string;
  status: "PRESENT" | "ABSENT" | null;
  recordId: string | null;
};

type Summary = {
  total: number;
  present: number;
  absent: number;
  unmarked: number;
};

export default function AttendanceClient({
  date,
  staffAttendance,
  summary,
}: {
  date: string;
  staffAttendance: StaffAttendance[];
  summary: Summary;
}) {
  const router = useRouter();
  const { isPending, run, error } = useAdminAction();
  const [localDate, setLocalDate] = useState(date);

  function navigate() {
    router.push(`/admin/attendance?date=${localDate}`);
  }

  function goToday() {
    const today = new Date().toISOString().slice(0, 10);
    setLocalDate(today);
    router.push(`/admin/attendance?date=${today}`);
  }

  function handleMarkAll() {
    const entries = staffAttendance.map((s) => ({ staffId: s.staffId, status: "PRESENT" as const }));
    run(() => bulkMarkAttendance(date, entries));
  }

  return (
    <>
      {error ? (
        <div className="rounded-2xl border border-destructive/35 bg-destructive-soft p-3.5 text-[12.5px] font-semibold text-destructive">
          {error}
        </div>
      ) : null}

      <BentoCard>
        <CardLabel>Tanggal</CardLabel>
        <div className="mt-2 flex flex-wrap items-end gap-2.5">
          <Input
            type="date"
            value={localDate}
            onChange={(e) => setLocalDate(e.target.value)}
            className="w-40 border-border bg-card-2"
          />
          <Button size="sm" onClick={navigate}>Lihat</Button>
          <Button size="sm" variant="ghost" onClick={goToday}>Hari Ini</Button>
        </div>
      </BentoCard>

      <div className="grid grid-cols-4 gap-2.5">
        <BentoCard className="text-center">
          <p className="font-display text-[20px] font-bold tabular-nums">{summary.total}</p>
          <p className="mt-0.5 text-[10.5px] font-semibold text-muted-foreground">Total</p>
        </BentoCard>
        <BentoCard className="text-center">
          <p className="font-display text-[20px] font-bold tabular-nums text-primary">{summary.present}</p>
          <p className="mt-0.5 text-[10.5px] font-semibold text-muted-foreground">Hadir</p>
        </BentoCard>
        <BentoCard className="text-center">
          <p className="font-display text-[20px] font-bold tabular-nums text-destructive">{summary.absent}</p>
          <p className="mt-0.5 text-[10.5px] font-semibold text-muted-foreground">Tidak Hadir</p>
        </BentoCard>
        <BentoCard className="text-center">
          <p className="font-display text-[20px] font-bold tabular-nums text-muted-foreground">{summary.unmarked}</p>
          <p className="mt-0.5 text-[10.5px] font-semibold text-muted-foreground">Belum</p>
        </BentoCard>
      </div>

      <div className="flex items-center justify-between px-1">
        <CardLabel>Daftar Staff ({staffAttendance.length})</CardLabel>
        <Button size="sm" variant="outline" disabled={isPending} onClick={handleMarkAll}>
          Tandai Semua Hadir
        </Button>
      </div>

      {staffAttendance.length === 0 ? (
        <p className="py-6 text-center text-[12.5px] font-semibold text-muted-foreground">
          Tidak ada staff aktif.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {staffAttendance.map((s) => (
            <Row key={s.staffId} title={s.staffName} meta={<RoleBadge role={s.role} />}>
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  variant={s.status === "PRESENT" ? "default" : "outline"}
                  disabled={isPending}
                  onClick={() => run(() => markAttendance(s.staffId, date, "PRESENT"))}
                >
                  Hadir
                </Button>
                <Button
                  size="sm"
                  variant={s.status === "ABSENT" ? "destructive" : "outline"}
                  disabled={isPending}
                  onClick={() => run(() => markAttendance(s.staffId, date, "ABSENT"))}
                >
                  Tidak Hadir
                </Button>
              </div>
            </Row>
          ))}
        </div>
      )}
    </>
  );
}
