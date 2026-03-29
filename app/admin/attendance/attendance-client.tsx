"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBanner, RoleBadge } from "@/components/admin/ui";
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Absensi Staff</h1>

      <ErrorBanner error={error} />

      {/* Date picker */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="grid gap-1">
              <Label>Tanggal</Label>
              <Input type="date" value={localDate} onChange={(e) => setLocalDate(e.target.value)} className="w-40" />
            </div>
            <Button onClick={navigate} size="sm">Lihat</Button>
            <Button variant="ghost" size="sm" onClick={goToday}>Hari Ini</Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{summary.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-primary">{summary.present}</p>
            <p className="text-xs text-muted-foreground">Hadir</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-destructive">{summary.absent}</p>
            <p className="text-xs text-muted-foreground">Tidak Hadir</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{summary.unmarked}</p>
            <p className="text-xs text-muted-foreground">Belum</p>
          </CardContent>
        </Card>
      </div>

      {/* Staff list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Daftar Staff</CardTitle>
            <Button size="sm" variant="outline" disabled={isPending} onClick={handleMarkAll}>
              Tandai Semua Hadir
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {staffAttendance.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Tidak ada staff aktif.</p>
          ) : (
            <div className="divide-y divide-foreground/5">
              {staffAttendance.map((s) => (
                <div key={s.staffId} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate">{s.staffName}</span>
                    <RoleBadge role={s.role} />
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="xs"
                      variant={s.status === "PRESENT" ? "default" : "outline"}
                      disabled={isPending}
                      onClick={() => run(() => markAttendance(s.staffId, date, "PRESENT"))}
                    >
                      Hadir
                    </Button>
                    <Button
                      size="xs"
                      variant={s.status === "ABSENT" ? "destructive" : "outline"}
                      disabled={isPending}
                      onClick={() => run(() => markAttendance(s.staffId, date, "ABSENT"))}
                    >
                      Tidak Hadir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
