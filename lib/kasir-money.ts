import { z } from "zod";
import { ActionError } from "@/lib/action-error";

/**
 * Server-side money validation for synced cashier transactions.
 *
 * This encodes the ACTUAL client money model (lib/kasir-utils.ts +
 * components/kasir/payment-screen.tsx), not an idealized one:
 * - `cashAmount` is the amount TENDERED for CASH (≥ total — change is the
 *   difference), and the cash PART of a SPLIT payment (0 < cash < total).
 * - `qrisAmount` equals the total for a pure QRIS payment and the remainder
 *   of a SPLIT; it is 0 otherwise.
 * - Subtotals exclude CANCELLED items.
 * - A finalized multi-group session pushes one aggregate transaction with
 *   splitGroup 0 whose subtotal spans items assigned to other groups.
 * - A PENDING-method transaction is recorded unpaid (cash/qris = 0) and is
 *   later settled — no payment check applies. VOIDED transactions skip too.
 *
 * Failures throw ActionError with user-facing Indonesian copy. Callers must
 * treat any throw as "this transaction MUST NOT be persisted" — the sync path
 * surfaces it instead of silently dropping the sale (see the retry note in
 * hooks/use-session-store.ts).
 */

const methodEnum = z.enum(["CASH", "QRIS", "SPLIT", "PENDING"]);
const statusEnum = z.enum(["PAID", "VOIDED"]);

export interface MoneyCheckTransaction {
  status: string;
  paymentMethod: string;
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  discountAmount: number;
  totalAmount: number;
  cashAmount: number;
  qrisAmount: number;
  splitGroup: number;
}

export interface MoneyCheckItem {
  status: string;
  price: number;
  qty: number;
  splitGroup: number;
}

export function assertTransactionMoney(tx: MoneyCheckTransaction): void {
  if (!statusEnum.safeParse(tx.status).success || !methodEnum.safeParse(tx.paymentMethod).success) {
    throw new ActionError("Metode pembayaran atau status transaksi tidak dikenal.");
  }
  if (tx.status === "VOIDED") return;

  // Component totals must add up exactly (integer rupiah, no rounding drift):
  // total = subtotal + tax + service − discount.
  const componentTotal =
    tx.subtotal + tx.taxAmount + tx.serviceCharge - tx.discountAmount;
  if (tx.totalAmount !== componentTotal) {
    throw new ActionError(
      `Total tidak cocok dengan rinciannya (${tx.totalAmount} vs ${componentTotal}).`,
    );
  }

  if (tx.paymentMethod === "PENDING") {
    // Unpaid now — settled later, no payment amounts to verify yet.
    return;
  }

  if (tx.paymentMethod === "CASH") {
    if (tx.qrisAmount !== 0) {
      throw new ActionError("Pembayaran tunai tidak boleh memiliki nominal QRIS.");
    }
    if (tx.cashAmount < tx.totalAmount) {
      throw new ActionError(
        "Uang tunai yang diterima kurang dari total tagihan.",
      );
    }
    return;
  }

  if (tx.paymentMethod === "QRIS") {
    if (tx.cashAmount !== 0 || tx.qrisAmount !== tx.totalAmount) {
      throw new ActionError("Pembayaran QRIS harus tepat sama dengan total tagihan.");
    }
    return;
  }

  // SPLIT: cash is the cash part, QRIS covers the remainder.
  if (tx.cashAmount <= 0 || tx.cashAmount >= tx.totalAmount) {
    throw new ActionError("Pembayaran campuran harus memiliki bagian tunai dan QRIS.");
  }
  if (tx.cashAmount + tx.qrisAmount !== tx.totalAmount) {
    throw new ActionError(
      `Pembayaran campuran tidak cocok: tunai + QRIS harus sama dengan total (${tx.totalAmount}).`,
    );
  }
}

/**
 * Subtotal cross-check against the pushed items. Separate from the payment
 * check above because it needs the item list, and because the aggregate
 * (finalized-session) case is only distinguishable with it.
 */
export function assertSubtotalMatchesItems(
  tx: MoneyCheckTransaction,
  orderItems: MoneyCheckItem[],
): void {
  if (tx.status === "VOIDED" || orderItems.length === 0) return;

  const active = orderItems.filter((i) => i.status !== "CANCELLED");
  const groupSubtotal = active
    .filter((i) => i.splitGroup === tx.splitGroup)
    .reduce((sum, i) => sum + i.price * i.qty, 0);
  const allSubtotal = active.reduce((sum, i) => sum + i.price * i.qty, 0);

  // The pushed items must explain the subtotal in one of the two legitimate
  // shapes: a per-group payment, or the finalized whole-session aggregate.
  if (tx.subtotal !== groupSubtotal && !(tx.splitGroup === 0 && tx.subtotal === allSubtotal)) {
    throw new ActionError(
      `Subtotal tidak cocok dengan item dipesan (${tx.subtotal} vs ${groupSubtotal}).`,
    );
  }
}
