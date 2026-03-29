import { Container } from "@/components/shared/container";
import { getTransactionsData } from "@/app/actions/admin/queries";
import TransactionsClient from "./transactions-client";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    method?: string;
    status?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const method = params.method ?? "";
  const status = params.status ?? "";
  const from = params.from ?? "";
  const to = params.to ?? "";

  const data = await getTransactionsData({ page, method, status, from, to });

  return (
    <Container id="admin-transactions" sectionStyle="" className="py-6">
      <TransactionsClient
        rows={data.rows}
        page={page}
        totalPages={data.totalPages}
        total={data.total}
        filters={{ method, status, from, to }}
      />
    </Container>
  );
}
