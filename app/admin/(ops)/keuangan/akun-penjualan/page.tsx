import { requireOwner } from "@/lib/admin-auth";
import { listCashAccounts, listSalesChannelAccounts } from "@/app/actions/admin/queries";
import { AkunPenjualanClient } from "./akun-penjualan-client";

export const dynamic = "force-dynamic";

export default async function AkunPenjualanPage() {
  await requireOwner();
  const [cashAccounts, channels] = await Promise.all([
    listCashAccounts(),
    listSalesChannelAccounts(),
  ]);

  return <AkunPenjualanClient cashAccounts={cashAccounts} channels={channels} />;
}
