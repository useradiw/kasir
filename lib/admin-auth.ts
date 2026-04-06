"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import type { Staff, RoleEnum } from "@/generated/prisma";

// Returns the authenticated Staff record if they have one of the given roles.
// Redirects to / otherwise.
export async function requireRole(...roles: RoleEnum[]): Promise<Staff> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const staff = await prisma.staff.findUnique({
    where: { supabaseUserId: user.id },
  });

  if (!staff || !staff.isActive || !roles.includes(staff.role)) redirect("/");

  return staff;
}

// Convenience: require OWNER role specifically.
export async function requireOwner(): Promise<Staff> {
  return requireRole("OWNER");
}

// Any active authenticated staff member passes — no role check.
export async function requireAuth(): Promise<Staff> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const staff = await prisma.staff.findUnique({
    where: { supabaseUserId: user.id },
  });

  if (!staff || !staff.isActive) redirect("/");

  return staff;
}
