import { redirect } from "next/navigation";
import { Container } from "@/components/shared/container";
import { getTransactionDetail } from "@/app/actions/admin/queries";
import TransactionDetailClient from "./transaction-detail-client";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getTransactionDetail(id);

  if (!data) redirect("/admin/transactions");

  return (
    <Container id="admin-transaction-detail" sectionStyle="" className="py-6">
      <TransactionDetailClient data={data} />
    </Container>
  );
}
