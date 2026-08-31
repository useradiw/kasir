import { isOnlineService } from "@/lib/day-close";

/**
 * One definition of "pendapatan" for every screen that shows it.
 *
 * This is the rule /admin/reports has used since before the Warung Books
 * branch, and the screens must not disagree about it: a sale made through
 * GoFood/ShopeeFood/GrabFood is NOT revenue when the order is taken — the
 * platform has the money. It becomes revenue when the pencairan lands, at the
 * amount actually disbursed, which is net of commission and deductions.
 *
 * So: recognised revenue = offline sales at their bill total, plus the final
 * amount of every settlement covering the period's online orders.
 */

export interface RevenueTransaction {
  totalAmount: number;
  /** tableSession.service — null for dine-in and takeaway. */
  service: string | null;
}

/** Sales taken in the shop: everything that is not an online-platform order. */
export function offlineSalesTotal(txs: RevenueTransaction[]): number {
  return txs
    .filter((t) => !isOnlineService(t.service))
    .reduce((sum, t) => sum + t.totalAmount, 0);
}

/**
 * Money actually disbursed by the platforms, from the settlements attached to
 * this period's online orders. Settlements are counted ONCE even when they
 * cover several transactions, which is why this takes the items and dedupes
 * by settlement rather than summing them per order.
 */
export function disbursedTotal(
  settlementItems: { settlementId: string; settlement: { finalAmount: number } }[],
): number {
  const seen = new Map<string, number>();
  for (const item of settlementItems) {
    seen.set(item.settlementId, item.settlement.finalAmount);
  }
  return [...seen.values()].reduce((sum, amount) => sum + amount, 0);
}

/** The figure a screen prints as "Pendapatan". */
export function recognisedRevenue(offline: number, disbursed: number): number {
  return offline + disbursed;
}
