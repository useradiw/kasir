"use server";

import { requireCan } from "@/lib/admin-auth";
import { getBukuKas as getBukuKasLib, getCekSaldo as getCekSaldoLib } from "@/lib/buku-kas";
export type { BukuKasAccount, BukuKasMovement, CekSaldoRow } from "@/lib/buku-kas";

/**
 * Owner-gated wrapper over getBukuKas (lib/buku-kas.ts). Exposes every kas
 * account's movements for a month — must never be callable without an owner
 * session, same reasoning as getLaporanKeuangan.
 */
export async function getBukuKas(month: string) {
  await requireCan("buku.read");
  return getBukuKasLib(month);
}

/**
 * Owner-gated wrapper over getCekSaldo (lib/buku-kas.ts).
 */
export async function getCekSaldo(month: string) {
  await requireCan("buku.read");
  return getCekSaldoLib(month);
}
