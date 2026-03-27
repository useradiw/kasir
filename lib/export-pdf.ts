import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Section {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

const TEAL = [0, 128, 128] as const;

function fmtRp(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

export function exportPDF(
  title: string,
  subtitle: string,
  summaryCards: { label: string; value: string }[],
  sections: Section[]
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // --- Header ---
  doc.setFontSize(18);
  doc.setTextColor(...TEAL);
  doc.text(title, 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(subtitle, 14, y);
  y += 10;

  // --- Summary Cards ---
  const cardW = (pageWidth - 28 - (summaryCards.length - 1) * 4) / summaryCards.length;
  for (let i = 0; i < summaryCards.length; i++) {
    const x = 14 + i * (cardW + 4);
    doc.setFillColor(240, 253, 250);
    doc.roundedRect(x, y, cardW, 18, 2, 2, "F");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(summaryCards[i].label, x + 4, y + 6);
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(summaryCards[i].value, x + 4, y + 14);
  }
  y += 26;

  // --- Sections ---
  for (const section of sections) {
    if (section.rows.length === 0) continue;

    // Check if we need a new page
    if (y > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      y = 15;
    }

    doc.setFontSize(11);
    doc.setTextColor(...TEAL);
    doc.text(section.title, 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [section.headers],
      body: section.rows.map((r) => r.map(String)),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: {
        fillColor: [...TEAL],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // --- Footer ---
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    const pageH = doc.internal.pageSize.getHeight();
    doc.text(
      `Dicetak: ${new Date().toLocaleString("id-ID")} | Halaman ${i}/${pageCount}`,
      14,
      pageH - 8
    );
  }

  doc.save(`${title.replace(/\s+/g, "_")}.pdf`);
}

export { fmtRp };
