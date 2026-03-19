"use server";

import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function getStaffId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const staff = await prisma.staff.findUnique({
    where: { supabaseUserId: user.id },
    select: { id: true, name: true, role: true, isActive: true },
  });

  if (!staff || !staff.isActive) redirect("/");

  return { staffId: staff.id, staffName: staff.name, staffRole: staff.role };
}
