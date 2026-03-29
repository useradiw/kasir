"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminSelect } from "@/components/admin/ui";
import { formatRupiah } from "@/lib/format";
import { exportCSV } from "@/lib/export-csv";
import { exportPDF, fmtRp } from "@/lib/export-pdf";
import type { ReportData } from "@/app/actions/admin/queries";

const COLORS = ["#0d9488", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const PERIOD_LABEL: Record<string, string> = {
  daily: "Harian",
  weekly: "Mingguan",
  monthly: "Bulanan",
};

const METHOD_LABEL: Record<string, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
};

const SERVICE_LABEL: Record<string, string> = {
  GoFood: "GoFood",
  ShopeeFood: "ShopeeFood",
  GrabFood: "GrabFood",
  Take_Away: "Take Away",
  Unknown: "Lainnya",
  "Dine In": "Dine In",
};

function shortDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function ReportClient({
  data,
  currentPeriod,
  currentDate,
}: {
  data: ReportData;
  currentPeriod: string;
  currentDate: string;
}) {
  const router = useRouter();
  const [showTransactions, setShowTransactions] = useState(false);

  function navigate(period: string, date: string) {
    router.push(`/admin/reports?period=${period}&date=${date}`);
  }

  function shiftDate(direction: -1 | 1) {
    const [y, m, d] = currentDate.split("-").map(Number);
    const base = new Date(y, m - 1, d);

    if (currentPeriod === "daily") base.setDate(base.getDate() + direction);
    else if (currentPeriod === "weekly") base.setDate(base.getDate() + direction * 7);
    else base.setMonth(base.getMonth() + direction);

    const newDate = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
    navigate(currentPeriod, newDate);
  }

  const dateRangeLabel = data.dateRange.start === data.dateRange.end
    ? shortDate(data.dateRange.start)
    : `${shortDate(data.dateRange.start)} – ${shortDate(data.dateRange.end)}`;

  // --- Export handlers ---
  function handleCSV() {
    const sections = [
      {
        title: `Laporan ${PERIOD_LABEL[currentPeriod]} (${dateRangeLabel})`,
        headers: ["Metrik", "Nilai"],
        rows: [
          ["Total Pendapatan", fmtRp(data.revenue.total)],
          ["Jumlah Transaksi", data.revenue.count],
          ["Rata-rata Transaksi", fmtRp(data.revenue.average)],
          ["Total Pengeluaran", fmtRp(data.totalExpenses)],
          ["Laba Bersih", fmtRp(data.netProfit)],
          ["Transaksi Void", data.voidedCount],
        ],
      },
      {
        title: "Pendapatan per Hari",
        headers: ["Tanggal", "Pendapatan", "Jumlah Transaksi"],
        rows: data.revenueByDay.map((r) => [r.date, r.revenue, r.count]),
      },
      {
        title: "Metode Pembayaran",
        headers: ["Metode", "Total", "Jumlah"],
        rows: data.paymentMethods.map((p) => [METHOD_LABEL[p.method] ?? p.method, p.amount, p.count]),
      },
      {
        title: "Item Terlaris",
        headers: ["Nama", "Qty", "Pendapatan"],
        rows: data.topItems.map((i) => [i.name, i.qty, i.revenue]),
      },
      {
        title: "Transaksi",
        headers: ["Tanggal", "Sesi", "Total", "Metode", "Kasir"],
        rows: data.transactions.map((t) => [
          new Date(t.paidAt).toLocaleString("id-ID"),
          t.sessionName,
          t.totalAmount,
          METHOD_LABEL[t.paymentMethod] ?? t.paymentMethod,
          t.processedBy ?? "-",
        ]),
      },
      {
        title: "Pengeluaran",
        headers: ["Tanggal", "Jumlah", "Catatan"],
        rows: data.expenses.map((e) => [
          new Date(e.recordedAt).toLocaleString("id-ID"),
          e.amount,
          e.note ?? "-",
        ]),
      },
    ];
    exportCSV(`Laporan_${currentPeriod}_${currentDate}.csv`, sections);
  }

  function handlePDF() {
    const title = `Laporan ${PERIOD_LABEL[currentPeriod]}`;
    const subtitle = `Periode: ${dateRangeLabel}`;
    const summaryCards = [
      { label: "Total Pendapatan", value: fmtRp(data.revenue.total) },
      { label: "Transaksi", value: String(data.revenue.count) },
      { label: "Pengeluaran", value: fmtRp(data.totalExpenses) },
      { label: "Laba Bersih", value: fmtRp(data.netProfit) },
    ];
    const sections = [
      {
        title: "Pendapatan per Hari",
        headers: ["Tanggal", "Pendapatan", "Jumlah Transaksi"],
        rows: data.revenueByDay.map((r) => [r.date, fmtRp(r.revenue), r.count]),
      },
      {
        title: "Metode Pembayaran",
        headers: ["Metode", "Total", "Jumlah"],
        rows: data.paymentMethods.map((p) => [METHOD_LABEL[p.method] ?? p.method, fmtRp(p.amount), p.count]),
      },
      {
        title: "Item Terlaris (Top 10)",
        headers: ["Nama", "Qty Terjual", "Pendapatan"],
        rows: data.topItems.map((i) => [i.name, i.qty, fmtRp(i.revenue)]),
      },
      {
        title: "Kas Harian",
        headers: ["Tanggal", "Kas Awal", "Pemasukan", "Pengeluaran", "Kas Akhir", "Selisih"],
        rows: data.cashRegisterSummary.map((c) => [
          c.date,
          fmtRp(c.openingCash),
          fmtRp(c.cashIncome),
          fmtRp(c.expenses),
          c.closingCash !== null ? fmtRp(c.closingCash) : "Belum tutup",
          c.difference !== null ? fmtRp(c.difference) : "-",
        ]),
      },
      {
        title: "Detail Transaksi",
        headers: ["Waktu", "Sesi", "Total", "Metode", "Kasir"],
        rows: data.transactions.map((t) => [
          new Date(t.paidAt).toLocaleString("id-ID"),
          t.sessionName,
          fmtRp(t.totalAmount),
          METHOD_LABEL[t.paymentMethod] ?? t.paymentMethod,
          t.processedBy ?? "-",
        ]),
      },
    ];
    exportPDF(title, subtitle, summaryCards, sections);
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold mr-auto">Laporan</h1>
        <AdminSelect
          value={currentPeriod}
          onChange={(e) => navigate(e.target.value, currentDate)}
        >
          <option value="daily">Harian</option>
          <option value="weekly">Mingguan</option>
          <option value="monthly">Bulanan</option>
        </AdminSelect>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => shiftDate(-1)}>
            &larr;
          </Button>
          <input
            type="date"
            value={currentDate}
            onChange={(e) => navigate(currentPeriod, e.target.value)}
            className="h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm"
          />
          <Button variant="ghost" size="sm" onClick={() => shiftDate(1)}>
            &rarr;
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={handleCSV}>
          CSV
        </Button>
        <Button variant="outline" size="sm" onClick={handlePDF}>
          PDF
        </Button>
      </div>

      {/* Period Label */}
      <p className="text-sm text-muted-foreground">
        {PERIOD_LABEL[currentPeriod]} — {dateRangeLabel}
      </p>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Total Pendapatan" value={formatRupiah(data.revenue.total)} />
        <SummaryCard label="Transaksi" value={`${data.revenue.count} (avg ${formatRupiah(data.revenue.average)})`} />
        <SummaryCard label="Pengeluaran" value={formatRupiah(data.totalExpenses)} />
        <SummaryCard
          label="Laba Bersih"
          value={formatRupiah(data.netProfit)}
          className={data.netProfit < 0 ? "text-destructive" : "text-primary"}
        />
      </div>

      {/* Charts Row 1: Revenue + Payment Methods */}
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pendapatan per Hari</CardTitle>
          </CardHeader>
          <CardContent>
            {data.revenueByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={shortDate} fontSize={11} />
                  <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} fontSize={11} />
                  <Tooltip
                    formatter={(value) => formatRupiah(value as number)}
                    labelFormatter={(label) => shortDate(String(label))}
                  />
                  <Bar dataKey="revenue" fill="#0d9488" radius={[4, 4, 0, 0]} name="Pendapatan" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">Tidak ada data.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Metode Pembayaran</CardTitle>
          </CardHeader>
          <CardContent>
            {data.paymentMethods.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={data.paymentMethods}
                    dataKey="amount"
                    nameKey="method"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    label={(props) => { const p = props as unknown as Record<string, string>; return METHOD_LABEL[p.method] ?? p.method; }}
                    fontSize={11}
                  >
                    {data.paymentMethods.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatRupiah(value as number)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">Tidak ada data.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Top Items + Service Channels */}
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Item Terlaris</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topItems.length > 0 ? (
              <div className="divide-y divide-foreground/5">
                {data.topItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <span className="text-sm">{item.name}</span>
                    <div className="text-right text-sm shrink-0 ml-3">
                      <span className="text-muted-foreground">{item.qty}×</span>
                      <span className="ml-2 font-medium">{formatRupiah(item.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">Tidak ada data.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Channel Layanan</CardTitle>
          </CardHeader>
          <CardContent>
            {data.serviceChannels.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={data.serviceChannels}
                    dataKey="amount"
                    nameKey="service"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    label={(props) => { const p = props as unknown as Record<string, string>; return SERVICE_LABEL[p.service] ?? p.service; }}
                    fontSize={11}
                  >
                    {data.serviceChannels.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatRupiah(value as number)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">Tidak ada data.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cash Register */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Kas Harian</CardTitle>
        </CardHeader>
        <CardContent>
          {data.cashRegisterSummary.length > 0 ? (
            <div className="divide-y divide-foreground/5">
              {data.cashRegisterSummary.map((c, i) => (
                <div key={i} className="py-2 space-y-0.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{shortDate(c.date)}</span>
                    <span className={c.difference !== null && c.difference < 0 ? "text-destructive" : ""}>
                      {c.difference !== null ? formatRupiah(c.difference) : "—"}
                    </span>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>Awal: {formatRupiah(c.openingCash)}</span>
                    <span>Akhir: {c.closingCash !== null ? formatRupiah(c.closingCash) : "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Tidak ada kas terdaftar.</p>
          )}
        </CardContent>
      </Card>

      {/* Attendance Summary (if available) */}
      {data.attendanceSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ringkasan Kehadiran</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-foreground/5">
              {data.attendanceSummary.map((a, i) => (
                <div key={i} className="flex items-center justify-between py-2 text-sm">
                  <span>{shortDate(a.date)}</span>
                  <div className="flex gap-3">
                    <span className="text-primary">{a.present} hadir</span>
                    <span className="text-destructive">{a.absent} absen</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Details (Collapsible) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Detail Transaksi ({data.transactions.length})</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowTransactions(!showTransactions)}>
              {showTransactions ? "Sembunyikan" : "Tampilkan"}
            </Button>
          </div>
        </CardHeader>
        {showTransactions && (
          <CardContent>
            {data.transactions.length > 0 ? (
              <div className="divide-y divide-foreground/5">
                {data.transactions.map((t) => (
                  <div key={t.id} className="py-2 space-y-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.sessionName}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(t.paidAt).toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                          {t.processedBy && <> · {t.processedBy}</>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium">{formatRupiah(t.totalAmount)}</p>
                        <span className="rounded-full px-2 py-0.5 text-xs bg-primary/10 text-primary">
                          {METHOD_LABEL[t.paymentMethod] ?? t.paymentMethod}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">Tidak ada transaksi.</p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Voided indicator */}
      {data.voidedCount > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {data.voidedCount} transaksi void tidak termasuk dalam perhitungan.
        </p>
      )}
    </div>
  );
}

function SummaryCard({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground font-normal">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-xl font-bold ${className ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
