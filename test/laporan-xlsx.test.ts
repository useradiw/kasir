/**
 * laporan-xlsx.test.ts — the Warung Books workbook layout.
 *
 * lib/laporan-xlsx.ts is a deliberate copy of the workbook Adi has read for
 * months ("Laporan Keuangan April 2026.xlsx"), so this file pins the SHAPE
 * rather than exercising exceljs: sheet names and order, the three-line header,
 * ALL-CAPS section bands, three-space indents on detail rows, and the totals
 * that must carry the exact wording of the original.
 *
 * It runs on a hand-built fixture rather than pglite because the module is
 * pure — no DB, no DOM, no exceljs — so a layout regression is caught in
 * milliseconds. The real baseline lives in scripts/migrasi/, which is
 * gitignored, so nothing here may depend on it.
 */

import { describe, it, expect } from "vitest";
import { buildLaporanWorkbook, RUPIAH_FORMAT, type XlsxRow } from "@/lib/laporan-xlsx";
import type { LaporanKeuangan } from "@/lib/laporan-keuangan";

const BUSINESS = "Sate Kambing Sido Mampir Katamso";

function line(label: string, amount: number) {
  return { account: `X:${label}`, label, amount };
}

const laporan = {
  month: "2026-04",
  period: {
    dateFrom: "2026-04-01",
    dateTo: "2026-04-30",
    label: "April 2026",
    scale: "bulan",
  },
  labaRugi: {
    title: "Laba Rugi",
    period: { from: "2026-04-01", to: "2026-04-30" },
    pendapatan: {
      lines: [line("Tunai", 6_008_000), line("QRIS", 1_431_000)],
      tunai: 6_008_000,
      qris: 1_431_000,
      online: 0,
      total: 7_439_000,
    },
    pengeluaran_bahan_baku: { lines: [line("Daging", 3_900_000)], total: 6_408_500 },
    laba_kotor: 1_030_500,
    pengeluaran_operasional: { lines: [line("Gaji", 4_850_000)], total: 7_812_900 },
    laba_bersih: -6_782_400,
  },
  neraca: {
    aset: { lines: [line("Kas Utama", 34_898_600)], total: 38_217_600 },
    kewajiban: { lines: [], total: 0 },
    ekuitas: { lines: [line("Modal Disetor", 45_000_000)], total: 38_217_600 },
  },
  arusKas: {
    operasi: -6_782_400,
    investasi: 0,
    pendanaan: 45_000_000,
    setoran_modal: 45_000_000,
    setoran_saldo_awal: 0,
    pengambilan_prive: 0,
    kas_awal: 0,
    kenaikan_kas_bersih: 38_217_600,
    kas_akhir: 38_217_600,
  },
  perubahanModal: {
    modal_awal: 0,
    tambahan_modal: 45_000_000,
    laba_bersih: -6_782_400,
    prive: 0,
    modal_akhir: 38_217_600,
  },
  validasi: {
    checks: [{ name: "Neraca seimbang", pass: true, detail: "Aset = 38.217.600" }],
    all_pass: true,
    sales_crosscheck: { total_gap: 0 },
  },
  calk: {
    sections: [
      {
        key: "dasar-penyusunan",
        title: "Dasar Penyusunan",
        generated: [{ label: "Dasar pencatatan", value: "Kas (cash basis)" }],
        note: "Catatan uji.",
      },
    ],
  },
} as unknown as LaporanKeuangan;

const sheets = buildLaporanWorkbook(laporan, BUSINESS);
const byName = (n: string) => sheets.find((s) => s.name === n)!;
const labels = (rows: XlsxRow[]) =>
  rows.map((r) =>
    "text" in r ? r.text : "label" in r ? r.label : "cells" in r ? r.cells[0] : "",
  );

describe("workbook structure", () => {
  it("carries Warung Books' five sheets, in order, plus kasir's CALK", () => {
    expect(sheets.map((s) => s.name)).toEqual([
      "LABA RUGI",
      "NERACA",
      "PERUBAHAN MODAL",
      "ARUS KAS",
      "VALIDASI",
      "CALK",
    ]);
  });

  it("opens every sheet with title, subtitle and business name", () => {
    for (const sheet of sheets) {
      const [a, b, c, d] = sheet.rows;
      expect(a?.kind, `${sheet.name} row 1`).toBe("title");
      expect(b?.kind, `${sheet.name} row 2`).toBe("muted");
      expect(c, `${sheet.name} row 3`).toEqual({ kind: "muted", text: BUSINESS });
      expect(d?.kind, `${sheet.name} row 4`).toBe("blank");
    }
  });

  it("names the period in each title", () => {
    expect((byName("LABA RUGI").rows[0] as { text: string }).text).toBe(
      "LAPORAN LABA RUGI - April 2026",
    );
    // Neraca is a point-in-time statement, so it is dated, not periodised.
    expect((byName("NERACA").rows[0] as { text: string }).text).toBe("NERACA - per 2026-04-30");
  });

  it("widens only the three-column sheets", () => {
    expect(byName("VALIDASI").wide).toBe(true);
    expect(byName("CALK").wide).toBe(true);
    expect(byName("LABA RUGI").wide).toBe(false);
  });
});

describe("LABA RUGI body", () => {
  const rows = byName("LABA RUGI").rows;

  it("uses the original ALL-CAPS section headings", () => {
    const sections = rows.filter((r) => r.kind === "section").map((r) => r.text);
    expect(sections).toEqual([
      "PENDAPATAN",
      "PENGELUARAN BAHAN BAKU",
      "PENGELUARAN OPERASIONAL",
    ]);
  });

  it("indents detail rows by three spaces and leaves totals flush", () => {
    for (const r of rows) {
      if (r.kind === "detail") expect(r.label.startsWith("   ")).toBe(true);
      if (r.kind === "total") expect(r.label.startsWith(" ")).toBe(false);
    }
  });

  it("keeps the exact total wording the original uses", () => {
    const totals = rows.filter((r) => r.kind === "total").map((r) => r.label);
    expect(totals).toEqual([
      "Total Pendapatan",
      "Total Pengeluaran Bahan Baku",
      "LABA KOTOR",
      "Total Pengeluaran Operasional",
      "LABA BERSIH",
    ]);
  });

  it("carries the figures through unchanged", () => {
    const total = rows.find((r) => r.kind === "total" && r.label === "LABA BERSIH");
    expect(total).toMatchObject({ amount: -6_782_400 });
  });
});

describe("statement-specific closing lines", () => {
  it("states the Neraca balance check in words", () => {
    expect(labels(byName("NERACA").rows)).toContain(
      "Seimbang (Aset = Kewajiban + Ekuitas): YA",
    );
  });

  it("reports an unbalanced Neraca as TIDAK rather than silently saying YA", () => {
    const broken = {
      ...laporan,
      neraca: { ...laporan.neraca, aset: { ...laporan.neraca.aset, total: 1 } },
    } as LaporanKeuangan;
    expect(labels(buildLaporanWorkbook(broken, BUSINESS)[1]!.rows)).toContain(
      "Seimbang (Aset = Kewajiban + Ekuitas): TIDAK",
    );
  });

  it("prints the Perubahan Modal formula", () => {
    expect(labels(byName("PERUBAHAN MODAL").rows)).toContain(
      "Modal Akhir = Modal Awal + Tambahan Modal + Laba Bersih - Prive",
    );
  });

  it("shows Prive negated, matching the CSV and CALK", () => {
    const prive = byName("PERUBAHAN MODAL").rows.find(
      (r) => r.kind === "detail" && r.label.includes("Prive"),
    );
    // The engine keeps Prive debit-positive; every human-facing surface negates
    // it so it reads as a reduction of equity.
    expect(prive).toMatchObject({ amount: -0 });
  });

  it("summarises the tie-out result", () => {
    expect(labels(byName("VALIDASI").rows)).toContain("HASIL: SEMUA TIE-OUT LULUS");
  });

  it("does not claim a pass when a check failed", () => {
    const failed = {
      ...laporan,
      validasi: { ...laporan.validasi, all_pass: false },
    } as LaporanKeuangan;
    expect(labels(buildLaporanWorkbook(failed, BUSINESS)[4]!.rows)).toContain(
      "HASIL: ADA TIE-OUT YANG GAGAL",
    );
  });
});

describe("yearly period", () => {
  it("labels a whole year in the title and the Neraca date", () => {
    const yearly = {
      ...laporan,
      month: "2026",
      period: {
        dateFrom: "2026-01-01",
        dateTo: "2026-12-31",
        label: "Tahun 2026",
        scale: "tahun",
      },
    } as LaporanKeuangan;
    const s = buildLaporanWorkbook(yearly, BUSINESS);
    expect((s[0]!.rows[0] as { text: string }).text).toBe("LAPORAN LABA RUGI - Tahun 2026");
    expect((s[1]!.rows[0] as { text: string }).text).toBe("NERACA - per 2026-12-31");
  });
});

describe("the Rupiah format is the one Excel expects", () => {
  it("matches the accounting format copied off the original workbook", () => {
    expect(RUPIAH_FORMAT).toBe('_-"Rp"* #,##0_-;\\-"Rp"* #,##0_-;_-"Rp"* "-"_-');
  });
});
