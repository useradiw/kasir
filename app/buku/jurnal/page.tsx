import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/admin-auth";
import { listJurnal } from "@/app/actions/admin/queries";
import { getSelectedMonth, monthRange } from "@/lib/keuangan-month";
import { JurnalClient } from "./jurnal-client";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** Local copy of the "YYYY-MM" -> "Agustus 2026" formatter (same duplication
 *  bulan-client.tsx and pengeluaran/page.tsx already carry on purpose —
 *  app/admin/keuangan is slated for deletion once every /buku equivalent
 *  exists). */
function formatMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return `${MONTH_NAMES[(mo ?? 1) - 1]} ${y}`;
}

/**
 * /buku/jurnal — the Jurnal entry list (SPEC #11), replaces
 * app/admin/keuangan/page.tsx (docs/redesign/plan-open-items.md section 1,
 * build order 6). Reuses listJurnal unchanged.
 */
export default async function BukuJurnalPage() {
  const staff = await requireOwner();
  const { dateFrom, dateTo, month } = monthRange(await getSelectedMonth());

  // includeVoid: true — the ONE deliberate behaviour change from the old
  // page, which hid VOID entries entirely. Mockup 6 shows them honestly with
  // a VOID tag, and a void is a real entry (an append-only reversal, never a
  // delete), so hiding it here would make the entry list disagree with the
  // ledger it is supposed to describe.
  const entries = await listJurnal({ dateFrom, dateTo, includeVoid: true });

  return (
    <AppShell role={staff.role}>
      <div className="px-4 pb-1 pt-5">
        <Link href="/buku" className="text-[12.5px] font-bold text-muted-foreground">
          ← Buku
        </Link>
        <h1 className="font-display mt-2 text-[17px] font-bold">Jurnal</h1>
        <p className="text-[11.5px] font-semibold text-muted-foreground">
          {formatMonth(month)} · {entries.length} entri
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        <JurnalClient entries={entries} />
      </div>
    </AppShell>
  );
}
