import { AppShell } from "@/components/shell/app-shell";
import { requireRole } from "@/lib/admin-auth";
import { getCashRegisterDataForStaff } from "@/app/actions/cashregister";
import { getCashRegisterData } from "@/app/actions/admin/queries";
import { KasOwner } from "@/components/kas/kas-owner";
import { KasCashier } from "@/components/kas/kas-cashier";

/**
 * /kas — the single register surface for every role (SPEC #6), Phase 3
 * (docs/redesign/plan-open-items.md section 3): the real screen from
 * screens-kas.html, built in components/kas/*, split by role. This page
 * stays the single data fetcher — getCashRegisterData (owner/manager) and
 * getCashRegisterDataForStaff (cashier) — untouched as query entry points.
 */
export default async function KasPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  // STAFF excluded — same register-access boundary the old /cashregister had.
  const staff = await requireRole("OWNER", "MANAGER", "CASHIER");
  const params = await searchParams;
  const from = params.from ?? "";
  const to = params.to ?? "";
  const filters = { from, to };

  const isManager = staff.role === "OWNER" || staff.role === "MANAGER" || staff.role === "DEVELOPER";

  if (isManager) {
    const data = await getCashRegisterData(filters);
    return (
      <AppShell role={staff.role}>
        <KasOwner
          staffRole={staff.role}
          cashAccountLabel={data.cashAccountLabel}
          todayRegister={data.todayRegister}
          todayCashIncome={data.todayCashIncome}
          todayExpenses={data.todayExpenses}
          todayExpectedClosing={data.todayExpectedClosing}
          todayQrisIncome={data.todayQrisIncome}
          todayCashTxnCount={data.todayCashTxnCount}
          todayMovements={data.todayMovements}
          registers={data.registers}
          filters={filters}
        />
      </AppShell>
    );
  }

  const data = await getCashRegisterDataForStaff(filters);
  return (
    <AppShell role={staff.role}>
      <KasCashier
        cashAccountLabel={data.cashAccountLabel}
        todayRegister={data.todayRegister}
        todayCashIncome={data.todayCashIncome}
        todayExpenses={data.todayExpenses}
        todayExpectedClosing={data.todayExpectedClosing}
        todayQrisIncome={data.todayQrisIncome}
        todayCashTxnCount={data.todayCashTxnCount}
        todayMovements={data.todayMovements}
        lockHours={data.lockHours}
        registers={data.registers}
        filters={filters}
      />
    </AppShell>
  );
}
