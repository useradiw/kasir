import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/shared/container";
import { getCashRegisterDataForStaff } from "@/app/actions/cashregister";
import CashRegisterStaffClient from "./cashregister-client";

export default async function CashRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const staff = await prisma.staff.findUnique({
    where: { supabaseUserId: user.id },
    select: { id: true, role: true },
  });

  if (!staff || !staff) redirect("/");

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
