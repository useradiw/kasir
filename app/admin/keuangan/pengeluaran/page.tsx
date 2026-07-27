import { listPengeluaran, listCategories, listCashAccounts } from "@/app/actions/admin/queries";
import { getSelectedMonth, monthRange } from "@/lib/keuangan-month";
import { PengeluaranClient } from "./pengeluaran-client";

export const dynamic = "force-dynamic";

export default async function PengeluaranPage() {
  const { dateFrom, dateTo, month } = monthRange(await getSelectedMonth());
  const [rows, categories, cashAccounts] = await Promise.all([
    listPengeluaran({ dateFrom, dateTo }),
    listCategories(),
    listCashAccounts(),
  ]);

  return (
    <PengeluaranClient
      cashAccounts={cashAccounts.map((a) => ({ name: a.name, label: a.label }))}
      categories={categories.filter((c) => c.active).map((c) => ({ code: c.code, name: c.name, bucket: c.bucket }))}
      rows={rows.map((r) => ({
        id: r.id,
        date: r.date,
        item: r.item,
        qty: r.qty,
        jumlah: r.jumlah,
        akun: r.akun,
        kategoriCode: r.kategoriCode,
        kategoriNama: r.kategoriNama,
      }))}
      month={month}
    />
  );
}
