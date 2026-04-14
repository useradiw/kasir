import { formatRupiah, formatDateTime } from "@/lib/format";
import type { StoreInfo } from "@/lib/settings";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PrintReceiptData {
  sessionName: string;
  cashierName: string;
  customerAlias: string | null;
  customerPhone?: string | null;
  serviceLabel: string;
  paidAt: string;
  items: Array<{ nameSnapshot: string; qty: number; price: number }>;
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: "CASH" | "QRIS";
  cashAmount: number;
  isPaid: boolean;
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
  return [...text(s), 0x0a];
}

function divider(w: number): number[] {
  return line("-".repeat(w));
}

/** Left-right aligned line: "Kasir: Adi           Dine In" */
function padLine(left: string, right: string, w: number): number[] {
  const gap = w - left.length - right.length;
  if (gap < 1) return line(left + " " + right);
  return line(left + " ".repeat(gap) + right);
}

// ─── Builders ────────────────────────────────────────────────────────────────

export function buildReceipt(
  data: PrintReceiptData,
  storeInfo: StoreInfo,
  lineWidth = 32,
): Uint8Array {
  const b: number[] = [];
  const w = lineWidth;

  // Init
  b.push(...CMD.INIT);

  // Store header
  b.push(...CMD.CENTER, ...CMD.BOLD_ON, ...CMD.DOUBLE_H);
  b.push(...line(storeInfo.name));
  b.push(...CMD.NORMAL, ...CMD.BOLD_OFF);
  b.push(...CMD.CENTER);
  b.push(...line(storeInfo.address));
  if (storeInfo.phone) b.push(...line(`Telp: ${storeInfo.phone}`));
  if (storeInfo.instagram) b.push(...line(`IG: ${storeInfo.instagram}`));

  // Cashier / customer / time / service
  b.push(...CMD.LEFT);
  b.push(...divider(w));
  b.push(...padLine(`Kasir: ${data.cashierName}`, data.serviceLabel, w));
  if (data.customerAlias) {
    b.push(...line(`Pelanggan: ${data.customerAlias}`));
  }
  // if (data.customerPhone) {
  //   b.push(...line(`HP: ${data.customerPhone}`));
  // }
  b.push(...line(formatDateTime(data.paidAt, "short")));

  // Total (large, centered)
  b.push(...divider(w));
  b.push(...CMD.CENTER, ...CMD.BOLD_ON, ...CMD.DOUBLE_H);
  b.push(...line(formatRupiah(data.totalAmount)));
  b.push(...CMD.NORMAL, ...CMD.BOLD_OFF);

  // Order items
  b.push(...CMD.LEFT);
  b.push(...divider(w));
  for (const item of data.items) {
    const name =
      item.nameSnapshot.length > 30
        ? item.nameSnapshot.slice(0, 30)
        : item.nameSnapshot;
    b.push(...CMD.BOLD_ON);
    b.push(...line(name));
    b.push(...CMD.BOLD_OFF);
    const detail = `  ${item.qty} x ${formatRupiah(item.price)}`;
    const lineTotal = formatRupiah(item.price * item.qty);
    b.push(...padLine(detail, lineTotal, w));
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

  // Payment info
  b.push(...divider(w));
  b.push(
    ...padLine("Metode", data.paymentMethod === "CASH" ? "Tunai" : "QRIS", w),
  );
  if (data.paymentMethod === "CASH") {
    b.push(...padLine("Dibayar", formatRupiah(data.cashAmount), w));
    const change = data.cashAmount - data.totalAmount;
    if (change > 0) b.push(...padLine("Kembalian", formatRupiah(change), w));
  }

  // Payment status
  b.push(...divider(w));
  b.push(...CMD.CENTER, ...CMD.BOLD_ON);
  b.push(...line(data.isPaid ? "** LUNAS **" : "** Belum Dibayar **"));
  b.push(...CMD.BOLD_OFF);

  // Footer
  b.push(...divider(w));
  b.push(...CMD.CENTER);
  const footerLines = storeInfo.receiptFooter.split("\n");
  for (const fl of footerLines) b.push(...line(fl));

  // Feed + Cut
  b.push(...CMD.FEED_3, ...CMD.CUT);

  return new Uint8Array(b);
}

export function buildChecklist(
  data: PrintChecklistData,
  lineWidth = 32,
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
