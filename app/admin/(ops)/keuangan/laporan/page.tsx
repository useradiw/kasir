import { requireOwner } from "@/lib/admin-auth";
import { getLaporanKeuangan } from "@/app/actions/admin/queries/laporan-keuangan-queries";
import { getSelectedMonth } from "@/lib/keuangan-month";
import { LaporanClient } from "./laporan-client";

export const dynamic = "force-dynamic";

/**
 * Laporan Keuangan — the six financial statements (Laba Rugi, Neraca, Arus
 * Kas, Perubahan Modal, CALK, Validasi) for the selected accounting month.
 * getLaporanKeuangan (lib/laporan-keuangan.ts) already builds the CALK
 * payload internally (CalkNotesRepository.listForMonth + buildCalk), so this
 * page does not duplicate that wiring — it only reads the selected month and
 * hands the whole result to the client.
 */
export default async function LaporanKeuanganPage() {
  await requireOwner();
  const month = await getSelectedMonth();
  const laporan = await getLaporanKeuangan(month);

  return <LaporanClient laporan={laporan} />;
}
