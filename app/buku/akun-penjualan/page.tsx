import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/admin-auth";
import { listCashAccounts, listSalesChannelAccounts } from "@/app/actions/admin/queries";
import { AkunPenjualanClient } from "./akun-penjualan-client";

export const dynamic = "force-dynamic";

/**
 * /buku/akun-penjualan — maps tunai/elektronik/online to kas accounts
 * (SPEC #20), replaces app/admin/keuangan/akun-penjualan. Reuses
 * listCashAccounts/listSalesChannelAccounts/setSalesChannelAccount unchanged
 * (docs/redesign/plan-open-items.md section 1, build order 2).
 */
export default async function BukuAkunPenjualanPage() {
  const staff = await requireOwner();
  const [cashAccounts, channels] = await Promise.all([
    listCashAccounts(),
    listSalesChannelAccounts(),
  ]);

  return (
    <AppShell role={staff.role}>
      <div className="px-4 pb-1 pt-5">
        <Link href="/buku" className="text-[12.5px] font-bold text-muted-foreground">
          ← Buku
        </Link>
        <h1 className="font-display mt-2 text-[17px] font-bold">Akun Penjualan</h1>
        <p className="text-[11.5px] font-semibold text-muted-foreground">
          Ke mana uang tiap kanal mengalir
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        <AkunPenjualanClient cashAccounts={cashAccounts} channels={channels} />
      </div>
    </AppShell>
  );
}
