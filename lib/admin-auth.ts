"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import type { Staff } from "@/generated/prisma";

// Call at the top of every admin server component / action.
// Returns the authenticated owner Staff record, or redirects to /.
export async function requireOwner(): Promise<Staff> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const staff = await prisma.staff.findUnique({
    where: { supabaseUserId: user.id },
  });

  if (!staff || !staff.isActive || staff.role !== "OWNER") redirect("/");

  return staff;
}
