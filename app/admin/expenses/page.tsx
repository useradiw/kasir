import { Container } from "@/components/shared/container";
import { getExpensesData } from "@/app/actions/admin/queries";
import { requireRole } from "@/lib/admin-auth";
import ExpensesClient from "./expenses-client";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const staff = await requireRole("OWNER", "MANAGER");
  const params = await searchParams;
  const from = params.from ?? "";
  const to = params.to ?? "";

  const data = await getExpensesData({ from, to });

  return (
    <Container id="admin-expenses" sectionStyle="" className="py-6">
      <ExpensesClient
        expenses={data.expenses}
        totalAmount={data.totalAmount}
        filters={{ from, to }}
        isOwner={staff.role === "OWNER"}
      />
    </Container>
  );
}
