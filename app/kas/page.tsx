import { AppShell } from "@/components/shell/app-shell";
import { requireRole } from "@/lib/admin-auth";
import { getCashRegisterDataForStaff } from "@/app/actions/cashregister";
import { getCashRegisterData } from "@/app/actions/admin/queries";
import CashRegisterStaffClient from "@/app/cashregister/cashregister-client";
import CashRegisterAdminClient from "@/app/admin/cash-register/cash-register-client";

/**
 * /kas — the single register surface for every role (SPEC #6). Owner/manager
 * get the admin view (edit/delete/recovery); cashier/staff get the shift view
 * with the lock countdown. Both render inside the unified shell so the old
 * twin pages (/cashregister, /admin/cash-register) could retire to redirects.
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

  const isManager = staff.role === "OWNER" || staff.role === "MANAGER" || staff.role === "DEVELOPER";

  if (isManager) {
    const data = await getCashRegisterData({ from, to });
    return (
      <AppShell role={staff.role}>
        <div className="px-4 py-5">
          <h1 className="font-display text-[17px] font-bold">Kas</h1>
          <p className="sub text-[11.5px] font-semibold text-muted-foreground">
            Kas harian — seluruh register
          </p>
        </div>
        <div className="px-4 pb-6">
          <CashRegisterAdminClient
            staffRole={staff.role}
            todayRegister={data.todayRegister}
            todayCashIncome={data.todayCashIncome}
            todayExpenses={data.todayExpenses}
            todayExpectedClosing={data.todayExpectedClosing}
            registers={data.registers}
            filters={{ from, to }}
          />
        </div>
      </AppShell>
    );
  }

  const data = await getCashRegisterDataForStaff({ from, to });
  return (
    <AppShell role={staff.role}>
      <div className="px-4 py-5">
        <h1 className="font-display text-[17px] font-bold">Kas</h1>
        <p className="text-[11.5px] font-semibold text-muted-foreground">
          Kas harian — shift kamu
        </p>
      </div>
      <div className="px-4 pb-6">
        <CashRegisterStaffClient
          todayRegister={data.todayRegister}
          todayCashIncome={data.todayCashIncome}
          todayExpenses={data.todayExpenses}
          todayExpectedClosing={data.todayExpectedClosing}
          lockHours={data.lockHours}
          registers={data.registers}
          filters={{ from, to }}
        />
      </div>
    </AppShell>
  );
}
