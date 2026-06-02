import { Container } from "@/components/shared/container";
import { requireAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import ExpenseInputClient from "./expense-input-client";

export default async function ExpensesPage() {
  await requireAuth();

  const ingredients = await prisma.ingredient.findMany({
    where:   { isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, unit: true, unitCost: true, category: true,
    },
  });

  return (
    <Container id="expenses" className="py-6">
      <ExpenseInputClient ingredients={ingredients} />
    </Container>
  );
}
