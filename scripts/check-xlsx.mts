/**
 * check-xlsx.mts — render a real .xlsx with the SAME applyWorkbook the browser
 * uses, so the Warung Books copy can be checked where it actually matters:
 * fonts, fills, column widths and number formats, none of which a unit test on
 * the pure spec can see.
 *
 * Read-only apart from the file it writes into the scratch path you pass.
 * No database.
 *
 *   npx tsx scripts/check-xlsx.mts <out.xlsx>
 */

import ExcelJS from "exceljs";
import { applyWorkbook, type WorkbookLike } from "../lib/export-xlsx.js";
import { buildLaporanWorkbook } from "../lib/laporan-xlsx.js";
import type { LaporanKeuangan } from "../lib/laporan-keuangan.js";

const out = process.argv[2];
if (!out) {
  console.error("usage: npx tsx scripts/check-xlsx.mts <out.xlsx>");
  process.exit(1);
}

const l = (label: string, amount: number) => ({ account: `X:${label}`, label, amount });

const laporan = {
  month: "2026-04",
  period: { dateFrom: "2026-04-01", dateTo: "2026-04-30", label: "April 2026", scale: "bulan" },
  labaRugi: {
    pendapatan: {
      lines: [l("Penjualan Tunai", 6_008_000), l("Penjualan QRIS", 1_431_000)],
      tunai: 6_008_000, qris: 1_431_000, online: 0, total: 7_439_000,
    },
    hpp: { lines: [l("Arang", 350_000), l("Daging", 3_900_000)], total: 6_408_500 },
    laba_kotor: 1_030_500,
    biaya_operasional: { lines: [l("Gaji", 4_850_000)], total: 7_812_900 },
    laba_bersih: -6_782_400,
  },
  neraca: {
    aset: { lines: [l("Kas Utama (Bank Mandiri)", 34_898_600)], total: 38_217_600 },
    kewajiban: { lines: [], total: 0 },
    ekuitas: { lines: [l("Modal Disetor", 45_000_000)], total: 38_217_600 },
  },
  arusKas: {
    operasi: -6_782_400, investasi: 0, pendanaan: 45_000_000,
    setoran_modal: 45_000_000, setoran_saldo_awal: 0, pengambilan_prive: 0,
    kas_awal: 0, kenaikan_kas_bersih: 38_217_600, kas_akhir: 38_217_600,
  },
  perubahanModal: {
    modal_awal: 0, tambahan_modal: 45_000_000, laba_bersih: -6_782_400,
    prive: 0, modal_akhir: 38_217_600,
  },
  validasi: {
    checks: [{ name: "Neraca seimbang: Aset = Kewajiban + Ekuitas", pass: true, detail: "Aset = 38,217,600" }],
    all_pass: true,
    sales_crosscheck: { total_gap: 0 },
  },
  calk: {
    sections: [{
      key: "dasar-penyusunan",
      title: "Dasar Penyusunan Laporan Keuangan",
      generated: [{ label: "Dasar pencatatan", value: "Kas (cash basis)" }],
      note: "",
    }],
  },
} as unknown as LaporanKeuangan;

const wb = new ExcelJS.Workbook();
applyWorkbook(wb as unknown as WorkbookLike, buildLaporanWorkbook(laporan, "Sate Kambing Sido Mampir Katamso"));
await wb.xlsx.writeFile(out);
console.log("wrote", out);
