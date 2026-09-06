import { formatRupiah } from "@/lib/format";
import { exportCSV } from "@/lib/export-csv";
import { exportPDF } from "@/lib/export-pdf";
import type { ReportData } from "@/app/actions/admin/queries";
import type { Period } from "./period-date";

const PERIOD_LABEL: Record<Period, string> = {
  daily: "Harian",
  weekly: "Mingguan",
  monthly: "Bulanan",
  yearly: "Tahunan",
};

const METHOD_LABEL: Record<string, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  SPLIT: "Split",
  PENDING: "Unsettled",
};

export function downloadCSV(data: ReportData, period: Period, date: string, dateRangeLabel: string) {
  const sections = [
    {
      title: `Laporan ${PERIOD_LABEL[period]} (${dateRangeLabel})`,
      headers: ["Metrik", "Nilai"],
      rows: [
        ["Total Pendapatan", formatRupiah(data.revenue.total)],
        ["Jumlah Transaksi", data.revenue.count],
        ["Rata-rata Transaksi", formatRupiah(data.revenue.average)],
        ["Total Pengeluaran", formatRupiah(data.totalExpenses)],
        ["Pengeluaran Bahan Baku", formatRupiah(data.bahanBaku)],
        ["Laba Kotor", formatRupiah(data.labaKotor)],
        ["Margin Kotor", data.labaKotorPct !== null ? `${data.labaKotorPct}%` : "-"],
        ["Laba Bersih", formatRupiah(data.netProfit)],
        ["Transaksi Void", data.voidedCount],
      ],
    },
    {
      title: period === "yearly" ? "Pendapatan per Bulan" : "Pendapatan per Hari",
      headers: [period === "yearly" ? "Bulan" : "Tanggal", "Pendapatan", "Jumlah Transaksi"],
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
      title: "Pengeluaran - Gaji Karyawan",
      headers: ["Nama", "Gaji/Hari", "Hari Hadir", "Total"],
      rows: data.staffSalary.map((s) => [s.name, s.dailySalary, s.presentDays, s.total]),
    },
    {
      title: "Pengeluaran - Operasional",
      headers: ["Tanggal", "Item", "Kategori", "Akun", "Jumlah", "Status"],
      rows: data.expenses.map((e) => [
        e.date,
        e.item,
        e.kategoriNama,
        e.akunLabel,
        e.jumlah,
        e.state,
      ]),
    },
  ];
  exportCSV(`Laporan_${period}_${date}.csv`, sections);
}

export async function downloadPDF(data: ReportData, period: Period, dateRangeLabel: string) {
  const title = `Laporan ${PERIOD_LABEL[period]}`;
  const subtitle = `Periode: ${dateRangeLabel}`;
  const summaryCards = [
    { label: "Total Pendapatan", value: formatRupiah(data.revenue.total) },
    { label: "Transaksi", value: String(data.revenue.count) },
    { label: "Pengeluaran", value: formatRupiah(data.totalExpenses) },
    { label: "Pengeluaran Bahan Baku", value: formatRupiah(data.bahanBaku) },
    { label: "Laba Kotor", value: formatRupiah(data.labaKotor) },
    { label: "Laba Bersih", value: formatRupiah(data.netProfit) },
  ];
  const sections = [
    {
      title: period === "yearly" ? "Pendapatan per Bulan" : "Pendapatan per Hari",
      headers: [period === "yearly" ? "Bulan" : "Tanggal", "Pendapatan", "Jumlah Transaksi"],
      rows: data.revenueByDay.map((r) => [r.date, formatRupiah(r.revenue), r.count]),
    },
    {
      title: "Metode Pembayaran",
      headers: ["Metode", "Total", "Jumlah"],
      rows: data.paymentMethods.map((p) => [METHOD_LABEL[p.method] ?? p.method, formatRupiah(p.amount), p.count]),
    },
    {
      title: "Item Terlaris (Top 10)",
      headers: ["Nama", "Qty Terjual", "Pendapatan"],
      rows: data.topItems.map((i) => [i.name, i.qty, formatRupiah(i.revenue)]),
    },
    {
      title: "Kas Harian",
      headers: ["Tanggal", "Kas Awal", "Pemasukan", "Pengeluaran", "Kas Akhir", "Selisih"],
      rows: data.cashRegisterSummary.map((c) => [
        c.date,
        formatRupiah(c.openingCash),
        formatRupiah(c.cashIncome),
        formatRupiah(c.expenses),
        c.closingCash !== null ? formatRupiah(c.closingCash) : "Belum tutup",
        c.difference !== null ? formatRupiah(c.difference) : "-",
      ]),
    },
    {
      title: "Detail Transaksi",
      headers: ["Waktu", "Sesi", "Total", "Metode", "Kasir"],
      rows: data.transactions.map((t) => [
        new Date(t.paidAt).toLocaleString("id-ID"),
        t.sessionName,
        formatRupiah(t.totalAmount),
        METHOD_LABEL[t.paymentMethod] ?? t.paymentMethod,
        t.processedBy ?? "-",
      ]),
    },
  ];
  await exportPDF(title, subtitle, summaryCards, sections);
}

export { METHOD_LABEL, PERIOD_LABEL };
