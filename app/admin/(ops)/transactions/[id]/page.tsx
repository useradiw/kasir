import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getTransactionDetail } from "@/app/actions/admin/queries";
import { requireCan } from "@/lib/admin-auth";
import { getStoreInfo } from "@/lib/settings";
import TransactionDetailClient from "./transaction-detail-client";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [staff, storeInfo] = await Promise.all([
    requireCan("transactions.read"),
    getStoreInfo(),
  ]);
  const { id } = await params;
  const data = await getTransactionDetail(id);

  if (!data) redirect("/admin/transactions");

  return (
    <AppShell role={staff.role}>
      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-6">
        <TransactionDetailClient data={data} isOwner={staff.role === "OWNER" || staff.role === "DEVELOPER"} storeInfo={storeInfo} />
      </div>
    </AppShell>
  );
}
