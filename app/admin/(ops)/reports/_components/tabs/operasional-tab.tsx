"use client";

import { BentoCard, CardLabel, Tag } from "@/components/shell/ui";
import { formatRupiah } from "@/lib/format";
import { shortDate } from "../../_utils/period-date";
import type { ReportData } from "@/app/actions/admin/queries";

export function OperasionalTab({ data, isOwner }: { data: ReportData; isOwner: boolean }) {
  return (
    <div className="flex flex-col gap-3">
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
    <BentoCard>
      <CardLabel>Kas Harian</CardLabel>
      {rows.length > 0 ? (
        <div className="mt-1 divide-y divide-border">
          {rows.map((c, i) => (
            <div key={i} className="space-y-0.5 py-2">
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="font-bold">{shortDate(c.date)}</span>
                <span
                  className={`tabular-nums ${c.difference !== null && c.difference < 0 ? "text-destructive" : ""}`}
                >
                  {c.difference !== null ? formatRupiah(c.difference) : "—"}
                </span>
              </div>
              <div className="flex gap-3 text-[11px] text-muted-foreground tabular-nums">
                <span>Awal: {formatRupiah(c.openingCash)}</span>
                <span>
                  Akhir: {c.closingCash !== null ? formatRupiah(c.closingCash) : "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-8 text-center text-[12.5px] font-semibold text-muted-foreground">Tidak ada kas terdaftar.</p>
      )}
    </BentoCard>
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
    <BentoCard>
      <CardLabel>Gaji Karyawan</CardLabel>
      <div className="mt-1 divide-y divide-border">
        {staff.map((s, i) => (
          <div key={i} className="py-2 text-[12.5px]">
            <div className="flex items-center justify-between">
              <span className="font-bold">{s.name}</span>
              <span className="text-destructive tabular-nums">
                {formatRupiah(s.total)}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {s.presentDays} hari × {formatRupiah(s.dailySalary)}
            </p>
          </div>
        ))}
        <div className="flex items-center justify-between py-2 text-[12.5px] font-bold">
          <span>Total Gaji</span>
          <span className="text-destructive tabular-nums">{formatRupiah(total)}</span>
        </div>
      </div>
    </BentoCard>
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
    <BentoCard>
      <CardLabel>Pengeluaran Operasional</CardLabel>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Dari buku besar (pengeluaran). Pengeluaran Bahan Baku ditampilkan terpisah di kartu Profitabilitas.
      </p>
      <div className="mt-1 divide-y divide-border">
        {expenses.map((e) => (
          <div key={e.id} className="space-y-0.5 py-2">
            <div className="flex items-center justify-between gap-2 text-[12.5px]">
              <span className="flex items-center gap-1.5 truncate pr-2">
                {e.item}
                {e.state === "VOID" && <Tag tone="bad">VOID</Tag>}
              </span>
              <span
                className={`shrink-0 tabular-nums ${e.state === "VOID" ? "text-muted-foreground line-through" : "text-destructive"}`}
              >
                {formatRupiah(e.jumlah)}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {shortDate(e.date)} · {e.kategoriNama} · {e.akunLabel}
            </p>
          </div>
        ))}
        <div className="flex items-center justify-between py-2 text-[12.5px] font-bold">
          <span>Total</span>
          <span className="text-destructive tabular-nums">{formatRupiah(total)}</span>
        </div>
      </div>
    </BentoCard>
  );
}

function AttendanceCard({ rows }: { rows: ReportData["attendanceSummary"] }) {
  return (
    <BentoCard>
      <CardLabel>Ringkasan Kehadiran</CardLabel>
      <div className="mt-1 divide-y divide-border">
        {rows.map((a, i) => (
          <div key={i} className="flex items-center justify-between py-2 text-[12.5px]">
            <span>{shortDate(a.date)}</span>
            <div className="flex gap-3 tabular-nums">
              <span className="text-primary">{a.present} hadir</span>
              <span className="text-destructive">{a.absent} absen</span>
            </div>
          </div>
        ))}
      </div>
    </BentoCard>
  );
}
