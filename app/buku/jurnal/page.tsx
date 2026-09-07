import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { requireCan } from "@/lib/admin-auth";
import { listJurnal } from "@/app/actions/admin/queries";
import { getSelectedMonth, monthRange } from "@/lib/keuangan-month";
import { JurnalClient } from "./jurnal-client";
import { formatMonth } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * /buku/jurnal — the Jurnal entry list (SPEC #11), replaces
 * app/admin/keuangan/page.tsx (docs/redesign/plan-open-items.md section 1,
 * build order 6). Reuses listJurnal unchanged.
 */
export default async function BukuJurnalPage() {
  const staff = await requireCan("buku.read");
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
        <Link href="/buku" className="cursor-pointer text-[12.5px] font-bold text-muted-foreground">
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
