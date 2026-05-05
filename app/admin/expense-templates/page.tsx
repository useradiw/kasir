import { Container } from "@/components/shared/container";
import { requireRole } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import ExpenseTemplatesClient from "./templates-client";

export default async function ExpenseTemplatesPage() {
  await requireRole("OWNER", "MANAGER");

  const templates = await prisma.expenseTemplate.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <Container id="admin-expense-templates" sectionStyle="" className="py-6">
      <ExpenseTemplatesClient
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          defaultUnit: t.defaultUnit,
          defaultCost: t.defaultCost,
        }))}
      />
    </Container>
  );
}
