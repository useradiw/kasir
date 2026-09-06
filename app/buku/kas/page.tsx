import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/admin-auth";
import { getBukuKas, getCekSaldo, listCashAccounts } from "@/app/actions/admin/queries";
import { getSelectedMonth } from "@/lib/keuangan-month";
import { getBukuSetupStatus, isBukuSetupComplete } from "@/lib/shell-queries";
import { KasClient } from "./kas-client";
import { formatMonth } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * /buku/kas — Buku Kas + Cek Saldo (SPEC #12), replaces
 * app/admin/keuangan/buku-kas (docs/redesign/plan-open-items.md section 1,
 * build order 7). A reskin: reuses getBukuKas/getCekSaldo/listCashAccounts
 * unchanged, same serializable shapes as the old page.
 *
 * Note this route is /buku/kas, distinct from the existing /kas cash-register
 * route — this page never touches /kas, /cashregister or /admin/cash-register.
 */
export default async function BukuKasPage() {
  const staff = await requireOwner();
  const month = await getSelectedMonth();
  const [accounts, cekSaldo, cashAccounts, setupStatus] = await Promise.all([
    getBukuKas(month),
    getCekSaldo(month),
    listCashAccounts(),
    getBukuSetupStatus(),
  ]);
  const setupComplete = isBukuSetupComplete(setupStatus);

  return (
    <AppShell role={staff.role}>
      <div className="px-4 pb-1 pt-5">
        <Link href="/buku" className="cursor-pointer text-[12.5px] font-bold text-muted-foreground">
          ← Buku
        </Link>
        <h1 className="font-display mt-2 text-[17px] font-bold">Buku Kas</h1>
        <p className="text-[11.5px] font-semibold text-muted-foreground">{formatMonth(month)}</p>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        <KasClient
          accounts={accounts}
          cekSaldo={cekSaldo}
          cashAccounts={cashAccounts.map((a) => ({ name: a.name, label: a.label }))}
          setupComplete={setupComplete}
        />
      </div>
    </AppShell>
  );
}
