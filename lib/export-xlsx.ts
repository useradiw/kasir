/**
 * export-xlsx.ts — render an XlsxSheet[] spec (lib/laporan-xlsx.ts) to a real
 * .xlsx file and hand it to the browser.
 *
 * exceljs is imported DYNAMICALLY, exactly as lib/export-pdf.ts does with
 * jsPDF: it is a large library that only matters the moment someone clicks
 * Unduh, so it must never enter the main bundle.
 *
 * Browser-only (Blob + document), like exportCSV and exportPDF. The layout it
 * renders is asserted in test/laporan-xlsx.test.ts against the pure spec, which
 * is why nothing here needs a DOM in the test suite.
 */

import { RUPIAH_FORMAT, STYLE, type XlsxSheet } from "@/lib/laporan-xlsx";

/**
 * The slice of exceljs's Worksheet that applyWorkbook actually touches.
 * Structural rather than an exceljs import, so this module carries no top-level
 * dependency on a library that must stay dynamically imported.
 */
interface CellLike {
  font?: { bold?: boolean; size?: number; color?: { argb: string } };
  fill?: { type: "pattern"; pattern: "solid"; fgColor: { argb: string } };
  numFmt?: string;
}
interface RowLike {
  getCell(col: number): CellLike;
}
interface WorksheetLike {
  getColumn(col: number): { width: number };
  addRow(values?: (string | number)[]): RowLike;
}
export interface WorkbookLike {
  addWorksheet(name: string): WorksheetLike;
}

/**
 * Apply the sheet spec to an exceljs workbook. Kept separate from the download
 * below so it has NO browser dependency: scripts/check-xlsx.mts renders a real
 * .xlsx with this exact function in node and diffs its styling against the
 * Warung Books original, which is the only way to prove the copy is faithful —
 * a unit test on the spec cannot see fonts, fills or number formats.
 */
export function applyWorkbook(workbook: WorkbookLike, sheets: XlsxSheet[]): void {
  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name);
    ws.getColumn(1).width = STYLE.colAWidth;
    ws.getColumn(2).width = sheet.wide ? STYLE.colBWidth : STYLE.colBWidth;
    if (sheet.wide) ws.getColumn(3).width = STYLE.colCWidth;

    for (const row of sheet.rows) {
      switch (row.kind) {
        case "title": {
          const r = ws.addRow([row.text]);
          r.getCell(1).font = { bold: true, size: 14, color: { argb: STYLE.titleColor } };
          break;
        }
        case "muted": {
          const r = ws.addRow([row.text]);
          r.getCell(1).font = { size: 10, color: { argb: STYLE.mutedColor } };
          break;
        }
        case "blank":
          ws.addRow([]);
          break;
        case "section": {
          const r = ws.addRow([row.text]);
          // Warung Books fills the whole used width of the header row, not just
          // the label cell, so the band reads as one bar.
          const lastCol = sheet.wide ? 3 : 2;
          for (let c = 1; c <= lastCol; c++) {
            r.getCell(c).font = { bold: true, size: 11 };
            r.getCell(c).fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: STYLE.sectionFill },
            };
          }
          break;
        }
        case "detail": {
          const r = ws.addRow([row.label, row.amount]);
          r.getCell(2).numFmt = RUPIAH_FORMAT;
          break;
        }
        case "total": {
          const r = ws.addRow([row.label, row.amount]);
          r.getCell(1).font = { bold: true, size: 11 };
          r.getCell(2).font = { bold: true, size: 11 };
          r.getCell(2).numFmt = RUPIAH_FORMAT;
          break;
        }
        case "note": {
          const r = ws.addRow([row.text]);
          r.getCell(1).font = { bold: true, size: 11 };
          break;
        }
        case "tableHead": {
          const r = ws.addRow(row.cells);
          for (let c = 1; c <= row.cells.length; c++) {
            r.getCell(c).font = { bold: true, size: 11 };
            r.getCell(c).fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: STYLE.sectionFill },
            };
          }
          break;
        }
        case "tableRow":
          ws.addRow(row.cells);
          break;
      }
    }
  }
}

export async function exportXLSX(filename: string, sheets: XlsxSheet[]): Promise<void> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  applyWorkbook(workbook as unknown as WorkbookLike, sheets);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
