import { requireOwner } from "@/lib/admin-auth";
import { getBukuKas, getCekSaldo, listCashAccounts } from "@/app/actions/admin/queries";
import { getSelectedMonth } from "@/lib/keuangan-month";
import { BukuKasClient } from "./buku-kas-client";

export const dynamic = "force-dynamic";

/**
 * Buku Kas + Cek Saldo (Slice 5). getBukuKas/getCekSaldo (lib/buku-kas.ts,
 * exposed via app/actions/admin/queries/buku-kas-queries.ts) already do the
 * heavy lifting — this page just reads the selected month (wb_month cookie,
 * shared with the rest of Keuangan via the MonthPicker in the parent layout)
 * and hands the results to the client.
 */
export default async function BukuKasPage() {
  await requireOwner();
  const month = await getSelectedMonth();
  const [accounts, cekSaldo, cashAccounts] = await Promise.all([
    getBukuKas(month),
    getCekSaldo(month),
    listCashAccounts(),
  ]);

  return (
    <BukuKasClient
      month={month}
      accounts={accounts}
      cekSaldo={cekSaldo}
      cashAccounts={cashAccounts.map((a) => ({ name: a.name, label: a.label }))}
    />
  );
}
