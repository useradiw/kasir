import { Container } from "@/components/shared/container";
import { requireAuth } from "@/lib/admin-auth";
import ExpenseInputClient from "./expense-input-client";

export default async function ExpensesPage() {
  await requireAuth();

  return (
    <Container id="expenses" className="py-6">
      <ExpenseInputClient />
    </Container>
  );
}
