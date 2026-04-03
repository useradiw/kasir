import { formatRupiah, formatDateTime } from "@/lib/format";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PrintReceiptData {
  sessionName: string;
  paidAt: string;
  items: Array<{ nameSnapshot: string; qty: number; price: number }>;
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: "CASH" | "QRIS";
  cashAmount: number;
}

export interface PrintChecklistData {
  sessionName: string;
  createdAt: string;
  items: Array<{ nameSnapshot: string; qty: number; note: string | null }>;
}

// ─── ESC/POS Commands ────────────────────────────────────────────────────────

const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
  INIT: [ESC, 0x40],
  CENTER: [ESC, 0x61, 0x01],
  LEFT: [ESC, 0x61, 0x00],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_H: [ESC, 0x21, 0x10],
  NORMAL: [ESC, 0x21, 0x00],
  FEED_3: [ESC, 0x64, 0x03],
  CUT: [GS, 0x56, 0x00],
} as const;

const encoder = new TextEncoder();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function text(s: string): number[] {
  return Array.from(encoder.encode(s));
}

function line(s: string): number[] {
  return [...text(s), 0x0a]; // append newline
}

function divider(w: number): number[] {
  return line("-".repeat(w));
}

/** Left-right aligned line: "2x Nasi Goreng      Rp 30.000" */
function padLine(left: string, right: string, w: number): number[] {
  const gap = w - left.length - right.length;
  if (gap < 1) return line(left + " " + right);
  return line(left + " ".repeat(gap) + right);
}

// ─── Builders ────────────────────────────────────────────────────────────────

export function buildReceipt(
  data: PrintReceiptData,
  lineWidth = 32
): Uint8Array {
  const b: number[] = [];
  const w = lineWidth;

  // Init + Header
  b.push(...CMD.INIT);
  b.push(...CMD.CENTER, ...CMD.BOLD_ON);
  b.push(...line("STRUK PEMBAYARAN"));
  b.push(...CMD.BOLD_OFF);
  b.push(...line(data.sessionName));
  b.push(...line(formatDateTime(data.paidAt, "short")));

  // Items
  b.push(...CMD.LEFT);
  b.push(...divider(w));
  for (const item of data.items) {
    const left = `${item.qty}x ${item.nameSnapshot}`;
    const right = formatRupiah(item.price * item.qty);
    b.push(...padLine(left, right, w));
  }

  // Charges
  b.push(...divider(w));
  b.push(...padLine("Subtotal", formatRupiah(data.subtotal), w));
  if (data.taxAmount > 0)
    b.push(...padLine("Pajak", "+" + formatRupiah(data.taxAmount), w));
  if (data.serviceCharge > 0)
    b.push(...padLine("Service", "+" + formatRupiah(data.serviceCharge), w));
  if (data.discountAmount > 0)
    b.push(...padLine("Diskon", "-" + formatRupiah(data.discountAmount), w));

  // Total
  b.push(...divider(w));
  b.push(...CMD.BOLD_ON, ...CMD.DOUBLE_H);
  b.push(...padLine("TOTAL", formatRupiah(data.totalAmount), w));
  b.push(...CMD.NORMAL, ...CMD.BOLD_OFF);

  // Payment info
  b.push(...divider(w));
  b.push(
    ...padLine(
      "Metode",
      data.paymentMethod === "CASH" ? "Tunai" : "QRIS",
      w
    )
  );
  if (data.paymentMethod === "CASH") {
    b.push(...padLine("Dibayar", formatRupiah(data.cashAmount), w));
    const change = data.cashAmount - data.totalAmount;
    if (change > 0)
      b.push(...padLine("Kembalian", formatRupiah(change), w));
  }

  // Footer
  b.push(...divider(w));
  b.push(...CMD.CENTER);
  b.push(...line("Terimakasih dan silahkan"));
  b.push(...line("datang kembali."));

  // Feed + Cut
  b.push(...CMD.FEED_3, ...CMD.CUT);

  return new Uint8Array(b);
}

export function buildChecklist(
  data: PrintChecklistData,
  lineWidth = 32
): Uint8Array {
  const b: number[] = [];
  const w = lineWidth;

  b.push(...CMD.INIT);
  b.push(...CMD.CENTER, ...CMD.BOLD_ON);
  b.push(...line("CHECKLIST PESANAN"));
  b.push(...CMD.BOLD_OFF);
  b.push(...line(data.sessionName));
  b.push(...line(formatDateTime(data.createdAt, "short")));

  b.push(...CMD.LEFT);
  b.push(...divider(w));

  for (const item of data.items) {
    b.push(...line(`${item.qty}x ${item.nameSnapshot}`));
    if (item.note) b.push(...line(`    ${item.note}`));
  }

  b.push(...divider(w));
  b.push(...CMD.CENTER, ...CMD.BOLD_ON);
  b.push(...line("Bukan Nota"));
  b.push(...CMD.BOLD_OFF);

  b.push(...CMD.FEED_3, ...CMD.CUT);

  return new Uint8Array(b);
}
