/**
 * day-close.ts — pure day-close sales aggregation (Slice 3a wiring).
 *
 * Deliberately has NO Prisma import of its own beyond types, so it can be
 * unit-tested without pglite and reused by both the action layer
 * (day-close-posting.ts) and the reconciliation query layer
 * (queries/_shared.ts) without either one re-deriving the money rules.
 */

export interface DaySalesInput {
  paymentMethod: "CASH" | "QRIS" | "SPLIT" | string;
  cashAmount: number;
  qrisAmount: number;
  totalAmount: number;
  /** tableSession.service — null for dine-in/takeaway (non-online) orders. */
  service: string | null;
}

export interface DaySalesTotals {
  cashSales: number;
  qrisSales: number;
}

/** Online-platform services whose revenue is recognized at settlement
 *  (Income:Sales:Online), never at day-close — see settlementPostingRepository. */
export const ONLINE_SERVICES = ["GoFood", "ShopeeFood", "GrabFood"] as const;

export function isOnlineService(service: string | null): boolean {
  return service !== null && (ONLINE_SERVICES as readonly string[]).includes(service);
}

/**
 * Sum a day's PAID transactions into cash/QRIS legs for the day-close posting.
 * Callers must pre-filter to `status: "PAID"` — this function does not filter
 * status itself.
 */
export function sumDaySales(txs: DaySalesInput[]): DaySalesTotals {
  let cashSales = 0;
  let qrisSales = 0;

  for (const tx of txs) {
    // Online-platform sales (GoFood/ShopeeFood/GrabFood) post at settlement
    // time, not here — counting them at day-close would double-book their
    // revenue. This is the single most important rule in this function.
    if (isOnlineService(tx.service)) continue;

    if (tx.paymentMethod === "CASH") {
      cashSales += tx.totalAmount;
    } else if (tx.paymentMethod === "QRIS") {
      qrisSales += tx.totalAmount;
    } else if (tx.paymentMethod === "SPLIT") {
      cashSales += tx.cashAmount;
      qrisSales += tx.qrisAmount;
    }
    // Any other/unknown payment method (e.g. "PENDING") is deliberately
    // ignored — we never guess which leg unrecognized money belongs to.
  }

  return { cashSales, qrisSales };
}
