import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/shared/container";
import ExpenseInputClient from "./expense-input-client";

export default async function ExpensesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const staff = await prisma.staff.findUnique({
    where: { supabaseUserId: user.id },
    select: { id: true, role: true, isActive: true },
  });

  if (!staff || !staff.isActive || staff.role === "STAFF") redirect("/");

  return (
    <Container id="expenses" className="py-6">
      <ExpenseInputClient />
    </Container>
  );
}
