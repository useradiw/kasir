import { Container } from "@/components/shared/container";
import { requireRole } from "@/lib/admin-auth";
import { getCashRegisterDataForStaff } from "@/app/actions/cashregister";
import CashRegisterStaffClient from "./cashregister-client";

export default async function CashRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const staff = await requireRole("OWNER", "MANAGER", "CASHIER");

  const params = await searchParams;
  const from = params.from ?? "";
  const to = params.to ?? "";

  const data = await getCashRegisterDataForStaff({ from, to });

  return (
    <Container id="cashregister" className="py-6">
      <CashRegisterStaffClient
        staffRole={staff.role}
        todayRegister={data.todayRegister}
        todayCashIncome={data.todayCashIncome}
        todayExpenses={data.todayExpenses}
        todayExpectedClosing={data.todayExpectedClosing}
        lockHours={data.lockHours}
        registers={data.registers}
        filters={{ from, to }}
      />
    </Container>
  );
}
