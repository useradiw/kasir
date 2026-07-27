import { listCatat, listCashAccounts } from "@/app/actions/admin/queries";
import { getSelectedMonth, monthRange } from "@/lib/keuangan-month";
import { CatatClient } from "../_components/catat-client";

export const dynamic = "force-dynamic";

export default async function ModalPage() {
  const { dateFrom, dateTo, month } = monthRange(await getSelectedMonth());
  const [rows, cashAccounts] = await Promise.all([
    listCatat("modal", { dateFrom, dateTo }),
    listCashAccounts(),
  ]);
  return (
    <CatatClient
      kind="modal"
      cashAccounts={cashAccounts.map((a) => ({ name: a.name, label: a.label }))}
      rows={rows.map((r) => ({ id: r.id, date: r.date, jumlah: r.jumlah, meta: r.meta, narration: r.narration }))}
      month={month}
    />
  );
}
