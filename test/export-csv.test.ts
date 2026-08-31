/**
 * export-csv.test.ts — buildCSV (lib/export-csv.ts). Pure.
 *
 * Only the string builder is testable here: exportCSV drives a browser
 * download through Blob/document.createElement and vitest runs in node.
 * The exact bytes matter — Excel is the consumer of these files.
 */

import { describe, it, expect } from "vitest";
import { buildCSV } from "@/lib/export-csv";

const section = {
  title: "Laporan",
  headers: ["Nama", "Total"],
  rows: [["Ayam Goreng", 2]],
};

describe("buildCSV", () => {
  it("starts with a UTF-8 BOM", () => {
    const csv = buildCSV([section]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });

  it("quotes a cell containing a comma", () => {
    const csv = buildCSV([{ ...section, rows: [["Ayam, Goreng", 2]] }]);
    expect(csv).toContain('"Ayam, Goreng",2');
  });

  it("doubles double quotes inside a cell", () => {
    const csv = buildCSV([{ ...section, rows: [['Sambal "Pedas"', 1]] }]);
    expect(csv).toContain('"Sambal ""Pedas""",1');
  });

  it("quotes a cell containing a newline", () => {
    const csv = buildCSV([{ ...section, rows: [["baris1\nbaris2", 1]] }]);
    expect(csv).toContain('"baris1\nbaris2",1');
  });

  it("separates sections with a blank line and ends with a trailing newline", () => {
    const csv = buildCSV([
      { title: "Laba Rugi", headers: ["Kategori", "Jumlah"], rows: [["Penjualan", 100]] },
      { title: "Pengeluaran", headers: ["Kategori", "Jumlah"], rows: [["Gaji", 50]] },
    ]);
    expect(csv).toBe(
      "\uFEFF" +
        "Laba Rugi\n" +
        "Kategori,Jumlah\n" +
        "Penjualan,100\n" +
        "\n" +
        "Pengeluaran\n" +
        "Kategori,Jumlah\n" +
        "Gaji,50\n",
    );
  });

  it("passes numbers through unquoted", () => {
    const csv = buildCSV([{ ...section, rows: [["Ayam", 12500], ["Paket", 99.5]] }]);
    expect(csv).toContain("Ayam,12500");
    expect(csv).toContain("Paket,99.5");
    expect(csv).not.toContain('"');
  });
});
