"use server";

/**
 * Owner-facing recovery endpoint for a day-close entry that never reached the
 * ledger (month was locked, channel accounts were unset, …). The
 * implementation lives in lib/day-close-posting.ts — the same function the
 * cashier close flow calls internally — because exporting it from a "use
 * server" file ungated would let any authenticated user trigger or repost
 * ledger entries for any register.
 */

import { requireCan } from "@/lib/admin-auth";
import { postDayCloseForRegister } from "@/lib/day-close-posting";

export async function repostDayCloseForRegister(
  cashRegisterId: string,
  opts?: { repost?: boolean },
): Promise<{ posted: boolean; reason?: string }> {
  await requireCan("dayclose.repost");
  return postDayCloseForRegister(cashRegisterId, opts);
}
