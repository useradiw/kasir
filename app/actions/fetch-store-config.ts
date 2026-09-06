"use server";

import { getSettings, SETTING_DEFAULTS } from "@/lib/settings";
import { requireAuth } from "@/lib/admin-auth";
import type { StoreInfo } from "@/lib/settings";

export type StoreConfig = {
  storeInfo: StoreInfo;
  defaultTaxPct: number;
  defaultServicePct: number;
};

/** Gated for the same reason as syncProducts: a "use server" export is a public
 *  POST endpoint, and this one returned store details and the default tax and
 *  service percentages to anyone. Called only from the authenticated shell. */
export async function fetchStoreConfig(): Promise<StoreConfig> {
  await requireAuth();
  const s = await getSettings();
  return {
    storeInfo: {
      name: s.store_name ?? SETTING_DEFAULTS.store_name,
      address: s.store_address ?? SETTING_DEFAULTS.store_address,
      phone: s.store_phone ?? SETTING_DEFAULTS.store_phone,
      instagram: s.store_instagram ?? SETTING_DEFAULTS.store_instagram,
      receiptFooter: s.receipt_footer ?? SETTING_DEFAULTS.receipt_footer,
    },
    defaultTaxPct: parseFloat(s.default_tax_pct) || 0,
    defaultServicePct: parseFloat(s.default_service_pct) || 0,
  };
}
