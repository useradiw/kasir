import { prisma } from "@/lib/prisma";

export const SETTING_DEFAULTS: Record<string, string> = {
  store_name: "Sate Kambing Sido Mampir",
  store_address: "Jl. Brigjen Katamso 51, Surakarta",
  store_phone: "",
  store_instagram: "@kambingsidomampir",
  receipt_footer: "Terimakasih dan silahkan datang kembali.",
  lock_hours: "4",
  default_tax_pct: "0",
  default_service_pct: "0",
};

export type StoreInfo = {
  name: string;
  address: string;
  phone: string;
  instagram: string;
  receiptFooter: string;
};

/** Fetch all settings from DB, seeding any missing defaults. */
export async function getSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany();
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;

  // Seed missing keys
  const missing = Object.entries(SETTING_DEFAULTS).filter(([k]) => !(k in map));
  if (missing.length > 0) {
    await prisma.setting.createMany({
      data: missing.map(([key, value]) => ({ key, value })),
      skipDuplicates: true,
    });
    for (const [k, v] of missing) map[k] = v;
  }

  return map;
}

/** Get a single setting value. */
export async function getSetting(key: string): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? SETTING_DEFAULTS[key] ?? "";
}

/** Get store info for receipts. */
export async function getStoreInfo(): Promise<StoreInfo> {
  const s = await getSettings();
  return {
    name: s.store_name ?? SETTING_DEFAULTS.store_name,
    address: s.store_address ?? SETTING_DEFAULTS.store_address,
    phone: s.store_phone ?? SETTING_DEFAULTS.store_phone,
    instagram: s.store_instagram ?? SETTING_DEFAULTS.store_instagram,
    receiptFooter: s.receipt_footer ?? SETTING_DEFAULTS.receipt_footer,
  };
}
