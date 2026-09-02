import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/admin-auth";
import { getLaporanKeuangan } from "@/app/actions/admin/queries/laporan-keuangan-queries";
import { getSelectedMonth } from "@/lib/keuangan-month";
import { LaporanClient } from "./laporan-client";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** Local copy of the "YYYY-MM" -> "Agustus 2026" formatter (same duplication
 *  every other rebuilt /buku screen carries on purpose — app/admin/keuangan
 *  is slated for deletion once every /buku equivalent exists). */
function formatMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return `${MONTH_NAMES[(mo ?? 1) - 1]} ${y}`;
}

/**
 * /buku/laporan — the six financial statements (Laba Rugi, Neraca, Arus Kas,
 * Perubahan Modal, CALK, Validasi) for the selected accounting month (SPEC
 * #10), replaces app/admin/keuangan/laporan (docs/redesign/plan-open-items.md
 * section 1, build order 8 — the last of the twelve rebuilt screens).
 *
 * getLaporanKeuangan (lib/laporan-keuangan.ts) already builds the CALK
 * payload internally (CalkNotesRepository.listForMonth + buildCalk), so this
 * page does not duplicate that wiring — it only reads the selected month and
 * hands the whole result to the client, same as the old page.
 */
export default async function BukuLaporanPage() {
  const staff = await requireOwner();
  const month = await getSelectedMonth();
  const laporan = await getLaporanKeuangan(month);

  return (
    <AppShell role={staff.role}>
      <div className="px-4 pb-1 pt-5">
        <Link href="/buku" className="text-[12.5px] font-bold text-muted-foreground">
          ← Buku
        </Link>
        <h1 className="font-display mt-2 text-[17px] font-bold">Laporan</h1>
        <p className="text-[11.5px] font-semibold text-muted-foreground">{formatMonth(month)}</p>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        <LaporanClient laporan={laporan} />
      </div>
    </AppShell>
  );
}
