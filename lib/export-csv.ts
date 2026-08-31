export interface CsvSection {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

/** CSV string builder with BOM and quoting — separated from exportCSV so it
 *  can be tested in node (vitest has no Blob/document). */
export function buildCSV(sections: CsvSection[]): string {
  const BOM = "\uFEFF";
  const lines: string[] = [];

  for (const section of sections) {
    lines.push(section.title);
    lines.push(section.headers.join(","));
    for (const row of section.rows) {
      lines.push(
        row.map((cell) => {
          const str = String(cell);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(",")
      );
    }
    lines.push(""); // blank line between sections
  }

  return BOM + lines.join("\n");
}

export function exportCSV(filename: string, sections: CsvSection[]) {
  const blob = new Blob([buildCSV(sections)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
