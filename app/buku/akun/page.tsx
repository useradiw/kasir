import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/admin-auth";
import { listCashAccounts } from "@/app/actions/admin/queries";
import { AkunClient } from "./akun-client";

export const dynamic = "force-dynamic";

/**
 * /buku/akun — chart-of-accounts setup (SPEC #19), replaces
 * app/admin/keuangan/akun. Reuses listCashAccounts/createCashAccount/
 * renameCashAccount/setCashAccountActive/seedStructuralChart unchanged
 * (docs/redesign/plan-open-items.md section 1, build order 1).
 */
export default async function BukuAkunPage() {
  const staff = await requireOwner();
  const accounts = await listCashAccounts(true);

  return (
    <AppShell role={staff.role}>
      <div className="px-4 pb-1 pt-5">
        <Link href="/buku" className="cursor-pointer text-[12.5px] font-bold text-muted-foreground">
          ← Buku
        </Link>
        <h1 className="font-display mt-2 text-[17px] font-bold">Akun Kas</h1>
        <p className="text-[11.5px] font-semibold text-muted-foreground">Struktur buku besar</p>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        <AkunClient accounts={accounts} />
      </div>
    </AppShell>
  );
}
