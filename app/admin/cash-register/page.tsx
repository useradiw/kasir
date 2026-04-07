import { Container } from "@/components/shared/container";
import { getCashRegisterData } from "@/app/actions/admin/queries";
import { requireRole } from "@/lib/admin-auth";
import CashRegisterClient from "./cash-register-client";

export default async function CashRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const staff = await requireRole("OWNER", "MANAGER");
  const params = await searchParams;
  const from = params.from ?? "";
  const to = params.to ?? "";

  const data = await getCashRegisterData({ from, to });

  return (
    <Container id="admin-cash-register" sectionStyle="" className="py-6">
      <CashRegisterClient
        staffRole={staff.role}
        todayRegister={data.todayRegister}
        todayCashIncome={data.todayCashIncome}
        todayExpenses={data.todayExpenses}
        todayExpectedClosing={data.todayExpectedClosing}
        registers={data.registers}
        filters={{ from, to }}
      />
    </Container>
  );
}
