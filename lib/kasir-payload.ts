import { z } from "zod";
import { ActionError } from "@/lib/action-error";
import {
  assertTransactionMoney,
  assertSubtotalMatchesItems,
} from "@/lib/kasir-money";

/**
 * Shape + money validation for the payload a cashier device syncs
 * (app/actions/push-transaction.ts). It lives here, not in the action, so it
 * can be tested: every export of a "use server" file is a callable endpoint,
 * and the project tests lib/ functions rather than the wrappers.
 *
 * The bar this code must clear: the pre-branch server accepted EVERY payload
 * without checking anything. Any shape the real cashier client can produce
 * must still be accepted, or a real sale is lost — the sync path only retries
 * and logs. test/money-parity.test.ts holds that line.
 */

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Tanggal tidak valid.");
/** Rupiah, always whole — the Prisma columns are Int, so a fraction could never persist. */
const money = z.number().int().nonnegative();
/**
 * Signed rupiah. totalAmount alone may go negative: the payment screen lets a
 * cashier enter a discount larger than the bill (percentage over 100, or an
 * absolute amount above the subtotal). The old server stored that; rejecting
 * it here would strand the sale on the device.
 */
const signedMoney = z.number().int();
/**
 * The text columns behind these fields are unbounded Postgres text and the
 * cashier inputs have no maxLength, so the cap only exists to bound an abusive
 * payload. TEXT_CAP is far above anything a person types on a POS.
 */
const TEXT_CAP = 2000;
const freeText = () => z.string().max(TEXT_CAP).nullable();

const serviceEnum = z.enum(["GoFood", "ShopeeFood", "GrabFood", "Take_Away", "Unknown"]);
const orderItemStatusEnum = z.enum(["PENDING", "PREPARING", "SERVED", "CANCELLED"]);
const paymentMethodEnum = z.enum(["CASH", "QRIS", "SPLIT", "PENDING"]);
const transactionStatusEnum = z.enum(["PAID", "VOIDED"]);

export const sessionSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(TEXT_CAP),
  service: serviceEnum.nullable(),
  externalOrderId: freeText(),
  customerAlias: freeText(),
  customerPhone: freeText(),
  ownerId: z.string().max(64).nullable(),
  orderedAt: isoDate.nullable(),
  servedAt: isoDate.nullable(),
  paidAt: isoDate.nullable(),
  erasedAt: isoDate.nullable(),
  createdAt: isoDate,
});

export const orderItemSchema = z.object({
  id: z.string().min(1).max(64),
  tableSessionId: z.string().min(1).max(64),
  menuItemId: z.string().max(64).nullable(),
  packageId: z.string().max(64).nullable(),
  variantId: z.string().max(64).nullable(),
  qty: z.number().int().positive(),
  note: freeText(),
  status: orderItemStatusEnum,
  nameSnapshot: z.string().min(1).max(TEXT_CAP),
  price: money,
  splitGroup: z.number().int().nonnegative(),
  preparedAt: isoDate.nullable(),
  servedAt: isoDate.nullable(),
  cancelledAt: isoDate.nullable(),
  createdAt: isoDate,
});

export const transactionSchema = z.object({
  id: z.string().min(1).max(64),
  tableSessionId: z.string().min(1).max(64),
  processedById: z.string().min(1).max(64),
  cashierName: z.string().max(TEXT_CAP).optional(),
  subtotal: money,
  taxAmount: money,
  serviceCharge: money,
  discountAmount: money,
  totalAmount: signedMoney,
  cashAmount: money,
  qrisAmount: money,
  paymentMethod: paymentMethodEnum,
  status: transactionStatusEnum,
  splitGroup: z.number().int().nonnegative(),
  paidAt: isoDate,
  createdAt: isoDate,
});

export type ParsedSession = z.infer<typeof sessionSchema>;
export type ParsedOrderItem = z.infer<typeof orderItemSchema>;
export type ParsedTransaction = z.infer<typeof transactionSchema>;

export interface ParsedPushPayload {
  session: ParsedSession;
  orderItems: ParsedOrderItem[];
  transaction: ParsedTransaction;
  /**
   * True when a retried payload's subtotal no longer matches its item list.
   * The sale is still written — see parsePushPayload — and the caller logs it.
   */
  subtotalDrift?: string;
}

/**
 * Where the payload came from, which decides whether the item list can be
 * trusted as the one that was paid for.
 *
 * - "payment": pushed immediately by recordPayment, so Dexie still holds
 *   exactly the items the cashier charged. The subtotal must match them.
 * - "retry": pushed by retryUnsyncedTransactions, which re-reads the session's
 *   items AT RETRY TIME — possibly days later, after edits. The subtotal is NOT
 *   required to match; rejecting there would strand a sale that was already
 *   collected in cash.
 *
 * Defaults to "retry" (the lenient reading) so an older client that sends no
 * origin can never have a sale rejected.
 */
export type PushOrigin = "payment" | "retry";

/**
 * Validates one synced sale end to end: shape, the menu/package XOR the schema
 * cannot express, and the money model. Throws on anything that must not be
 * persisted; the caller treats a throw as "do not write this row".
 */
export function parsePushPayload(payload: {
  session: unknown;
  orderItems: unknown;
  transaction: unknown;
  origin?: PushOrigin;
}): ParsedPushPayload {
  const session = sessionSchema.parse(payload.session);
  const orderItems = z.array(orderItemSchema).parse(payload.orderItems);
  const transaction = transactionSchema.parse(payload.transaction);

  for (const item of orderItems) {
    if (item.menuItemId && item.packageId) {
      throw new ActionError(`Item ${item.id}: tidak boleh memiliki menu dan paket sekaligus.`);
    }
    if (!item.menuItemId && !item.packageId) {
      throw new ActionError(`Item ${item.id}: harus memiliki menu atau paket.`);
    }
  }

  // Always enforced: this one is self-contained arithmetic on the transaction
  // itself (total = components, payment covers total), so it holds no matter
  // how old the payload is.
  assertTransactionMoney(transaction);

  // Only enforced on a fresh payment, where the item list is the one that was
  // charged. On a retry a mismatch is reported, not rejected.
  let subtotalDrift: string | undefined;
  if (payload.origin === "payment") {
    assertSubtotalMatchesItems(transaction, orderItems);
  } else {
    try {
      assertSubtotalMatchesItems(transaction, orderItems);
    } catch (e) {
      subtotalDrift = e instanceof Error ? e.message : String(e);
    }
  }

  return { session, orderItems, transaction, subtotalDrift };
}
