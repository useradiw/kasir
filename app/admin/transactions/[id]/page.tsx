import { redirect } from "next/navigation";
import { Container } from "@/components/shared/container";
import { getTransactionDetail } from "@/app/actions/admin/queries";
import { requireRole } from "@/lib/admin-auth";
import { getStoreInfo } from "@/lib/settings";
import TransactionDetailClient from "./transaction-detail-client";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [staff, storeInfo] = await Promise.all([
    requireRole("OWNER", "MANAGER"),
    getStoreInfo(),
  ]);
  const { id } = await params;
  const data = await getTransactionDetail(id);

  if (!data) redirect("/admin/transactions");

  return (
    <Container id="admin-transaction-detail" sectionStyle="" className="py-6">
      <TransactionDetailClient data={data} isOwner={staff.role === "OWNER"} storeInfo={storeInfo} />
    </Container>
  );
}
