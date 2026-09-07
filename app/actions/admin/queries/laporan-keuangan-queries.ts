"use server";

import { requireCan } from "@/lib/admin-auth";
import { buildLaporanKeuangan } from "@/lib/laporan-keuangan";
export type { LaporanKeuangan } from "@/lib/laporan-keuangan";

/**
 * Owner-gated wrapper over buildLaporanKeuangan (lib/laporan-keuangan.ts).
 * getLaporanKeuangan returns the entire financial position of the business,
 * so it must never be callable without an owner session — see
 * buildLaporanKeuangan's own doc comment for what it computes.
 */
export async function getLaporanKeuangan(month: string) {
  await requireCan("buku.read");
  return buildLaporanKeuangan(month);
}
