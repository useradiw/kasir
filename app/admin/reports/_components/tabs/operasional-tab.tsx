"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah } from "@/lib/format";
import { shortDate } from "../../_utils/period-date";
import type { ReportData } from "@/app/actions/admin/queries";

export function OperasionalTab({ data, isOwner }: { data: ReportData; isOwner: boolean }) {
  return (
    <div className="space-y-6">
      {isOwner && <CashRegisterCard rows={data.cashRegisterSummary} />}
      {isOwner && data.staffSalary.length > 0 && (
        <StaffSalaryCard staff={data.staffSalary} total={data.totalSalary} />
      )}
      {isOwner && data.expenses.length > 0 && (
        <ExpensesCard expenses={data.expenses} total={data.totalExpenses} />
      )}
      {data.attendanceSummary.length > 0 && (
        <AttendanceCard rows={data.attendanceSummary} />
      )}
    </div>
  );
}

function CashRegisterCard({ rows }: { rows: ReportData["cashRegisterSummary"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Kas Harian</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length > 0 ? (
          <div className="divide-y divide-foreground/5">
            {rows.map((c, i) => (
              <div key={i} className="py-2 space-y-0.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{shortDate(c.date)}</span>
                  <span
                    className={`tabular-nums ${c.difference !== null && c.difference < 0 ? "text-destructive" : ""}`}
                  >
                    {c.difference !== null ? formatRupiah(c.difference) : "—"}
                  </span>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground tabular-nums">
                  <span>Awal: {formatRupiah(c.openingCash)}</span>
                  <span>
                    Akhir: {c.closingCash !== null ? formatRupiah(c.closingCash) : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">Tidak ada kas terdaftar.</p>
        )}
      </CardContent>
    </Card>
  );
}

function StaffSalaryCard({
  staff,
  total,
}: {
  staff: ReportData["staffSalary"];
  total: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Gaji Karyawan</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-foreground/5">
          {staff.map((s, i) => (
            <div key={i} className="py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{s.name}</span>
                <span className="text-destructive tabular-nums">
                  {formatRupiah(s.total)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {s.presentDays} hari × {formatRupiah(s.dailySalary)}
              </p>
            </div>
          ))}
          <div className="flex items-center justify-between py-2 text-sm font-medium">
            <span>Total Gaji</span>
            <span className="text-destructive tabular-nums">{formatRupiah(total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ExpensesCard({
  expenses,
  total,
}: {
  expenses: ReportData["expenses"];
  total: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Pengeluaran Operasional</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-foreground/5">
          {expenses.map((e) => (
            <div key={e.id} className="flex items-center justify-between py-2 text-sm">
              <span className="truncate pr-2">{e.description ?? "-"}</span>
              <span className="text-destructive shrink-0 tabular-nums">
                {formatRupiah(e.total)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between py-2 text-sm font-medium">
            <span>Total</span>
            <span className="text-destructive tabular-nums">{formatRupiah(total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AttendanceCard({ rows }: { rows: ReportData["attendanceSummary"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Ringkasan Kehadiran</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-foreground/5">
          {rows.map((a, i) => (
            <div key={i} className="flex items-center justify-between py-2 text-sm">
              <span>{shortDate(a.date)}</span>
              <div className="flex gap-3 tabular-nums">
                <span className="text-primary">{a.present} hadir</span>
                <span className="text-destructive">{a.absent} absen</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
