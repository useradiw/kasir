/**
 * laporan-csv.ts — Laporan Keuangan -> CSV sections (Slice 4).
 *
 * Pure, no "use server" — unit-testable without booting Next. Ported from
 * tokokencana's lib/laporan-csv.ts, adapted to kasir's existing CSV contract:
 * `exportCSV(filename, sections)` (lib/export-csv.ts) already prepends the BOM
 * and quotes cells, so this module only needs to shape the data into
 * `{ title, headers, rows }[]` — no papaparse, no download helper here. The
 * client calls `exportCSV(filename, buildLaporanSections(laporan))` directly.
 *
 * Prive sign convention: the statement engine (changesInEquity.ts) keeps Prive
 * debit-positive (money taken out is a positive number internally — see its
 * doc comment). Both this CSV and lib/calk.ts display it NEGATED, so a human
 * reading either sees Prive as a reduction of equity, consistent across the two.
 */

import type { LaporanKeuangan } from "@/app/actions/admin/queries/laporan-keuangan-queries";

export interface CsvSection {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

export function buildLaporanSections(laporan: LaporanKeuangan): CsvSection[] {
  const { labaRugi, neraca, arusKas, perubahanModal, validasi, calk } = laporan;
  const sections: CsvSection[] = [];

  sections.push({
    title: "LABA RUGI",
    headers: ["Akun", "Jumlah"],
    rows: [
      ...labaRugi.pendapatan.lines.map((l) => [l.label, l.amount]),
      ["Total Pendapatan", labaRugi.pendapatan.total],
      ...labaRugi.pengeluaran_bahan_baku.lines.map((l) => [l.label, l.amount]),
      ["Total Pengeluaran Bahan Baku", labaRugi.pengeluaran_bahan_baku.total],
      ["Laba Kotor", labaRugi.laba_kotor],
      ...labaRugi.pengeluaran_operasional.lines.map((l) => [l.label, l.amount]),
      ["Total Pengeluaran Operasional", labaRugi.pengeluaran_operasional.total],
      ["Laba Bersih", labaRugi.laba_bersih],
    ],
  });

  sections.push({
    title: "NERACA",
    headers: ["Akun", "Jumlah"],
    rows: [
      ...neraca.aset.lines.map((l) => [l.label, l.amount]),
      ["Total Aset", neraca.aset.total],
      ["Total Liabilitas", neraca.kewajiban.total],
      ...neraca.ekuitas.lines.map((l) => [l.label, l.amount]),
      ["Total Ekuitas", neraca.ekuitas.total],
    ],
  });

  sections.push({
    title: "ARUS KAS",
    headers: ["Pos", "Jumlah"],
    rows: [
      ["Kas dari Operasi", arusKas.operasi],
      ["Kas dari Investasi", arusKas.investasi],
      ["Kas dari Pendanaan", arusKas.pendanaan],
      ["  Setoran Modal", arusKas.setoran_modal],
      ["  Setoran Saldo Awal", arusKas.setoran_saldo_awal],
      ["  Pengambilan Prive", arusKas.pengambilan_prive],
      ["Kas Awal", arusKas.kas_awal],
      ["Kenaikan Kas Bersih", arusKas.kenaikan_kas_bersih],
      ["Kas Akhir", arusKas.kas_akhir],
    ],
  });

  sections.push({
    title: "PERUBAHAN MODAL",
    headers: ["Pos", "Jumlah"],
    rows: [
      ["Modal Awal", perubahanModal.modal_awal],
      ["Tambahan Modal", perubahanModal.tambahan_modal],
      ["Laba Bersih", perubahanModal.laba_bersih],
      ["Prive", -perubahanModal.prive],
      ["Modal Akhir", perubahanModal.modal_akhir],
    ],
  });

  sections.push({
    title: "VALIDASI",
    headers: ["Pemeriksaan", "Status", "Detail"],
    rows: [
      ...validasi.checks.map((c) => [c.name, c.pass ? "OK" : "GAGAL", c.detail]),
      ["Selisih Cross-check Total", validasi.all_pass ? "OK" : "GAGAL", String(validasi.sales_crosscheck.total_gap)],
    ],
  });

  sections.push({
    title: "CATATAN ATAS LAPORAN KEUANGAN",
    headers: ["Bagian", "Rincian", "Catatan"],
    rows: calk.sections.map((s) => [
      s.title,
      s.generated.map((g) => `${g.label}: ${g.value}`).join("; "),
      s.note,
    ]),
  });

  return sections;
}
