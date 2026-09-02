import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/admin-auth";
import { getBukuKas, getCekSaldo, listCashAccounts } from "@/app/actions/admin/queries";
import { getSelectedMonth } from "@/lib/keuangan-month";
import { KasClient } from "./kas-client";

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
  const [accounts, cekSaldo, cashAccounts] = await Promise.all([
    getBukuKas(month),
    getCekSaldo(month),
    listCashAccounts(),
  ]);

  return (
    <AppShell role={staff.role}>
      <div className="px-4 pb-1 pt-5">
        <Link href="/buku" className="text-[12.5px] font-bold text-muted-foreground">
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
        />
      </div>
    </AppShell>
  );
}
