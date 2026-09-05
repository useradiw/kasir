import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/admin-auth";
import { getLaporanKeuangan } from "@/app/actions/admin/queries/laporan-keuangan-queries";
import { listMonths } from "@/app/actions/admin/queries";
import { getSelectedMonth } from "@/lib/keuangan-month";
import { getStoreInfo } from "@/lib/settings";
import { periodKeyFromParam, resolvePeriod, yearOf } from "@/lib/laporan-period";
import { getBukuSetupStatus, isBukuSetupComplete } from "@/lib/shell-queries";
import { LaporanClient } from "./laporan-client";
import { LaporanActions } from "./laporan-actions";

export const dynamic = "force-dynamic";

/**
 * /buku/laporan — the six financial statements (Laba Rugi, Neraca, Arus Kas,
 * Perubahan Modal, CALK, Validasi) for the selected period (SPEC #10),
 * replaces app/admin/keuangan/laporan (docs/redesign/plan-open-items.md
 * section 1, build order 8 — the last of the twelve rebuilt screens).
 *
 * getLaporanKeuangan (lib/laporan-keuangan.ts) already builds the CALK
 * payload internally (CalkNotesRepository.listForPeriod + buildCalk), so this
 * page does not duplicate that wiring — it only resolves the period and hands
 * the whole result to the client.
 *
 * The period lives in the URL (`?periode=2026-04` or `?periode=2026`), NOT in
 * the shared `wb_month` cookie that /buku/bulan sets. Adi chose this on
 * 2026-09-05: laporan is the one screen you browse across periods, and writing
 * the cookie from here would silently retarget jurnal, buku kas and
 * pengeluaran at whatever you last looked at. The cookie is still the DEFAULT,
 * so arriving with no query string shows the active month exactly as before.
 */
export default async function BukuLaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const staff = await requireOwner();
  const [{ periode }, activeMonth] = await Promise.all([searchParams, getSelectedMonth()]);
  const periodKey = periodKeyFromParam(periode, activeMonth);
  const period = resolvePeriod(periodKey);

  const [laporan, setupStatus, months, store] = await Promise.all([
    getLaporanKeuangan(periodKey),
    getBukuSetupStatus(),
    listMonths(),
    getStoreInfo(),
  ]);
  const setupComplete = isBukuSetupComplete(setupStatus);

  // Years are derived from the months that exist rather than stored separately
  // — a year is reportable exactly when some month of it is.
  const years = [...new Set(months.map((m) => yearOf(m.month)))].sort().reverse();

  return (
    <AppShell role={staff.role}>
      <div className="px-4 pb-1 pt-5">
        <Link href="/buku" className="cursor-pointer text-[12.5px] font-bold text-muted-foreground">
          ← Buku
        </Link>
        {/* Period and download live in the header, per the mockup
            (docs/redesign/screens-laporan.html) — the body stays one row of
            chrome. */}
        <div className="mt-2 flex items-center gap-2">
          <h1 className="font-display text-[17px] font-bold">Laporan</h1>
          <div className="ml-auto">
            <LaporanActions
              laporan={laporan}
              months={months}
              years={years}
              activePeriod={periodKey}
              businessName={store.name}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        <p className="text-[11px] font-semibold text-muted-foreground">
          Periode {period.dateFrom} s/d {period.dateTo}
        </p>
        <LaporanClient laporan={laporan} setupComplete={setupComplete} />
      </div>
    </AppShell>
  );
}
