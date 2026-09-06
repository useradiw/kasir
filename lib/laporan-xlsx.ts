/**
 * laporan-xlsx.ts — Laporan Keuangan -> Warung Books' XLSX layout.
 *
 * This is a deliberate, faithful copy of the workbook Warung Books produces
 * ("Laporan Keuangan April 2026.xlsx"), read straight off the real file on
 * 2026-09-05 rather than guessed. Adi has read those workbooks for months and
 * asked for the same thing here, so the styling constants below are a SPEC, not
 * taste — do not "improve" them without asking:
 *
 *   - two columns, A width 46, B width 20
 *   - A1 title      bold 14pt, #1F4E78
 *   - A2 subtitle   10pt, #666666   ("Periode: April 2026")
 *   - A3 business   10pt, #666666
 *   - A4 blank
 *   - section head  bold 11pt on #D9E1F2 fill, ALL CAPS
 *   - detail row    label indented three spaces, amount in the Rupiah
 *                   accounting format below
 *   - total row     bold, no fill
 *   - blank row between sections
 *
 * Warung Books ships five sheets; kasir adds CALK, which it has no equivalent
 * for. VALIDASI is the one three-column sheet.
 *
 * This module is PURE — it builds a plain description of the workbook and does
 * no IO, so test/laporan-xlsx.test.ts can assert the layout in node without
 * exceljs or a DOM. The renderer that turns it into a file lives in
 * lib/export-xlsx.ts.
 */

import type { LaporanKeuangan } from "@/app/actions/admin/queries/laporan-keuangan-queries";

/** Number format copied verbatim from the Warung Books workbook. */
export const RUPIAH_FORMAT = '_-"Rp"* #,##0_-;\\-"Rp"* #,##0_-;_-"Rp"* "-"_-';

export const STYLE = {
  titleColor: "FF1F4E78",
  mutedColor: "FF666666",
  sectionFill: "FFD9E1F2",
  colAWidth: 46,
  colBWidth: 20,
  colCWidth: 60,
} as const;

export type XlsxRow =
  | { kind: "title"; text: string }
  | { kind: "muted"; text: string }
  | { kind: "blank" }
  | { kind: "section"; text: string }
  | { kind: "detail"; label: string; amount: number }
  | { kind: "total"; label: string; amount: number }
  /** A plain bold statement with no amount, e.g. "Seimbang (...): YA". */
  | { kind: "note"; text: string }
  | { kind: "tableHead"; cells: string[] }
  | { kind: "tableRow"; cells: string[] };

export interface XlsxSheet {
  name: string;
  /** Three-column sheets (VALIDASI) widen column C and skip the money format. */
  wide: boolean;
  rows: XlsxRow[];
}

/** Warung Books indents every detail line by three spaces inside the cell. */
function indent(label: string): string {
  return `   ${label}`;
}

function header(title: string, subtitle: string, business: string): XlsxRow[] {
  return [
    { kind: "title", text: title },
    { kind: "muted", text: subtitle },
    { kind: "muted", text: business },
    { kind: "blank" },
  ];
}

export function buildLaporanWorkbook(
  laporan: LaporanKeuangan,
  business: string,
): XlsxSheet[] {
  const { labaRugi, neraca, arusKas, perubahanModal, validasi, calk } = laporan;
  const periodLabel = laporan.period.label;
  const asOf = laporan.period.dateTo;

  const labaRugiRows: XlsxRow[] = [
    ...header(`LAPORAN LABA RUGI - ${periodLabel}`, `Periode: ${periodLabel}`, business),
    { kind: "section", text: "PENDAPATAN" },
    ...labaRugi.pendapatan.lines.map(
      (l): XlsxRow => ({ kind: "detail", label: indent(l.label), amount: l.amount }),
    ),
    { kind: "total", label: "Total Pendapatan", amount: labaRugi.pendapatan.total },
    { kind: "blank" },
    { kind: "section", text: "PENGELUARAN BAHAN BAKU" },
    ...labaRugi.pengeluaran_bahan_baku.lines.map(
      (l): XlsxRow => ({ kind: "detail", label: indent(l.label), amount: l.amount }),
    ),
    { kind: "total", label: "Total Pengeluaran Bahan Baku", amount: labaRugi.pengeluaran_bahan_baku.total },
    { kind: "total", label: "LABA KOTOR", amount: labaRugi.laba_kotor },
    { kind: "blank" },
    { kind: "section", text: "PENGELUARAN OPERASIONAL" },
    ...labaRugi.pengeluaran_operasional.lines.map(
      (l): XlsxRow => ({ kind: "detail", label: indent(l.label), amount: l.amount }),
    ),
    { kind: "total", label: "Total Pengeluaran Operasional", amount: labaRugi.pengeluaran_operasional.total },
    { kind: "total", label: "LABA BERSIH", amount: labaRugi.laba_bersih },
  ];

  const neracaRows: XlsxRow[] = [
    ...header(`NERACA - per ${asOf}`, `Posisi keuangan per ${asOf}`, business),
    { kind: "section", text: "ASET" },
    ...neraca.aset.lines.map(
      (l): XlsxRow => ({ kind: "detail", label: indent(l.label), amount: l.amount }),
    ),
    { kind: "total", label: "Total Aset", amount: neraca.aset.total },
    { kind: "blank" },
    { kind: "section", text: "KEWAJIBAN" },
    { kind: "detail", label: indent("Kewajiban"), amount: neraca.kewajiban.total },
    { kind: "total", label: "Total Kewajiban", amount: neraca.kewajiban.total },
    { kind: "blank" },
    { kind: "section", text: "EKUITAS" },
    ...neraca.ekuitas.lines.map(
      (l): XlsxRow => ({ kind: "detail", label: indent(l.label), amount: l.amount }),
    ),
    { kind: "total", label: "Total Ekuitas", amount: neraca.ekuitas.total },
    { kind: "total", label: "Kewajiban + Ekuitas", amount: neraca.kewajiban.total + neraca.ekuitas.total },
    {
      kind: "note",
      // Warung Books states the balance check in words on the sheet itself.
      text: `Seimbang (Aset = Kewajiban + Ekuitas): ${
        neraca.aset.total === neraca.kewajiban.total + neraca.ekuitas.total ? "YA" : "TIDAK"
      }`,
    },
  ];

  const arusKasRows: XlsxRow[] = [
    ...header(`ARUS KAS (metode langsung) - ${periodLabel}`, `Periode: ${periodLabel}`, business),
    { kind: "section", text: "ARUS KAS" },
    { kind: "detail", label: indent("Arus Kas dari Aktivitas Operasi"), amount: arusKas.operasi },
    { kind: "detail", label: indent("Arus Kas dari Aktivitas Investasi"), amount: arusKas.investasi },
    { kind: "detail", label: indent("Arus Kas dari Aktivitas Pendanaan"), amount: arusKas.pendanaan },
    { kind: "total", label: "Kenaikan Kas Bersih", amount: arusKas.kenaikan_kas_bersih },
    { kind: "blank" },
    { kind: "section", text: "REKONSILIASI KAS" },
    { kind: "detail", label: indent("Kas Awal Periode"), amount: arusKas.kas_awal },
    { kind: "detail", label: indent("Kenaikan Kas Bersih"), amount: arusKas.kenaikan_kas_bersih },
    { kind: "total", label: "Kas Akhir Periode", amount: arusKas.kas_akhir },
  ];

  const modalRows: XlsxRow[] = [
    ...header(`PERUBAHAN MODAL - ${periodLabel}`, `Periode: ${periodLabel}`, business),
    { kind: "section", text: "PERUBAHAN MODAL PEMILIK" },
    { kind: "detail", label: indent("Modal Awal"), amount: perubahanModal.modal_awal },
    { kind: "detail", label: indent("Tambahan Modal"), amount: perubahanModal.tambahan_modal },
    { kind: "detail", label: indent("Laba Bersih"), amount: perubahanModal.laba_bersih },
    // Negated for display, matching lib/laporan-csv.ts and lib/calk.ts: the
    // engine keeps Prive debit-positive, but a reader expects a reduction.
    { kind: "detail", label: indent("Prive (Pengambilan Pemilik)"), amount: -perubahanModal.prive },
    { kind: "total", label: "Modal Akhir", amount: perubahanModal.modal_akhir },
    {
      kind: "note",
      text: "Modal Akhir = Modal Awal + Tambahan Modal + Laba Bersih - Prive",
    },
  ];

  const validasiRows: XlsxRow[] = [
    ...header(
      `VALIDASI (tie-out) - ${periodLabel}`,
      "Setiap pemeriksaan harus PASS; jika gagal laporan ditolak.",
      business,
    ),
    { kind: "tableHead", cells: ["Pemeriksaan", "Status", "Detail"] },
    ...validasi.checks.map(
      (c): XlsxRow => ({
        kind: "tableRow",
        cells: [c.name, c.pass ? "PASS" : "GAGAL", c.detail],
      }),
    ),
    { kind: "blank" },
    {
      kind: "note",
      text: `HASIL: ${validasi.all_pass ? "SEMUA TIE-OUT LULUS" : "ADA TIE-OUT YANG GAGAL"}`,
    },
  ];

  // CALK has no Warung Books counterpart, so it follows the same visual rules
  // rather than copying a layout that does not exist.
  const calkRows: XlsxRow[] = [
    ...header(
      `CATATAN ATAS LAPORAN KEUANGAN - ${periodLabel}`,
      `Periode: ${periodLabel}`,
      business,
    ),
  ];
  for (const section of calk.sections) {
    calkRows.push({ kind: "section", text: section.title.toUpperCase() });
    for (const g of section.generated) {
      calkRows.push({ kind: "tableRow", cells: [indent(g.label), String(g.value)] });
    }
    if (section.note) {
      calkRows.push({ kind: "tableRow", cells: [indent("Catatan"), section.note] });
    }
    calkRows.push({ kind: "blank" });
  }

  return [
    { name: "LABA RUGI", wide: false, rows: labaRugiRows },
    { name: "NERACA", wide: false, rows: neracaRows },
    { name: "PERUBAHAN MODAL", wide: false, rows: modalRows },
    { name: "ARUS KAS", wide: false, rows: arusKasRows },
    { name: "VALIDASI", wide: true, rows: validasiRows },
    { name: "CALK", wide: true, rows: calkRows },
  ];
}
