export function exportCSV(
  filename: string,
  sections: { title: string; headers: string[]; rows: (string | number)[][] }[]
) {
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

  const blob = new Blob([BOM + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
