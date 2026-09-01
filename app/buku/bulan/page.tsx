import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/admin-auth";
import { listMonths } from "@/app/actions/admin/queries";
import { BulanClient } from "./bulan-client";

export const dynamic = "force-dynamic";

/**
 * /buku/bulan — closed-month list with Tutup/Buka/Kunci Paksa (SPEC #21),
 * replaces app/admin/keuangan/bulan. Reuses listMonths/lockMonth/unlockMonth
 * unchanged (docs/redesign/plan-open-items.md section 1, build order 4).
 * Also carries month CREATION (createMonth), which on the old surface lived
 * in the shared Keuangan layout's "+ Bulan" MonthPicker, not on the bulan
 * page itself — there is no equivalent layout under /buku, and
 * screens-buku.html mockup 3 shows "+ Baru" on this exact screen, so the
 * capability is kept here rather than dropped.
 */
export default async function BukuBulanPage() {
  const staff = await requireOwner();
  const months = await listMonths();

  return (
    <AppShell role={staff.role}>
      <div className="px-4 pb-1 pt-5">
        <Link href="/buku" className="text-[12.5px] font-bold text-muted-foreground">
          ← Buku
        </Link>
        <h1 className="font-display mt-2 text-[17px] font-bold">Bulan</h1>
        <p className="text-[11.5px] font-semibold text-muted-foreground">Tutup buku & kunci periode</p>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        <BulanClient months={months} />
      </div>
    </AppShell>
  );
}
