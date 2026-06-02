import { Container } from "@/components/shared/container";
import { getExpensesData } from "@/app/actions/admin/queries";
import { requireRole } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
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

  const [data, ingredients] = await Promise.all([
    getExpensesData({ from, to }),
    prisma.ingredient.findMany({
      where:   { isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, unit: true, unitCost: true, category: true,
      },
    }),
  ]);

  return (
    <Container id="admin-expenses" sectionStyle="" className="py-6">
      <ExpensesClient
        expenses={data.expenses}
        totalAmount={data.totalAmount}
        filters={{ from, to }}
        isOwner={staff.role === "OWNER" || staff.role === "DEVELOPER"}
        ingredients={ingredients}
      />
    </Container>
  );
}
