import { Container } from "@/components/shared/container";
import { requireAuth } from "@/lib/admin-auth";
import { listCategories, listCashAccounts } from "@/app/actions/admin/queries";
import { ExpensesInputClient } from "./expenses-input-client";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  await requireAuth();
  const [categories, cashAccounts] = await Promise.all([
    listCategories(),
    listCashAccounts(),
  ]);

  return (
    <Container id="expenses" className="py-6">
      <ExpensesInputClient
        cashAccounts={cashAccounts.map((a) => ({ name: a.name, label: a.label }))}
        categories={categories.filter((c) => c.active).map((c) => ({ code: c.code, name: c.name, bucket: c.bucket }))}
      />
    </Container>
  );
}
