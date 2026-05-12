"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";

export async function getStaffWithEmails() {
  await requireRole("OWNER", "MANAGER");

  const staffList = await prisma.staff.findMany({ orderBy: { createdAt: "asc" } });

  const supabase = createAdminClient();
  const emailMap: Record<string, string> = {};
  const linkedIds = staffList.map((s) => s.supabaseUserId).filter(Boolean) as string[];

  if (linkedIds.length > 0) {
    const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (data?.users) {
      for (const u of data.users) {
        if (linkedIds.includes(u.id)) emailMap[u.id] = u.email ?? "";
      }
    }
  }

  return staffList.map((s) => ({
    id: s.id,
    username: s.username,
    name: s.name,
    role: s.role as "OWNER" | "MANAGER" | "CASHIER" | "STAFF",
    isActive: s.isActive,
    salary: s.salary,
    supabaseUserId: s.supabaseUserId,
    supabaseEmail: s.supabaseUserId ? (emailMap[s.supabaseUserId] ?? null) : null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));
}

export async function getSessionsData() {
  await requireRole("OWNER", "MANAGER");

  const supabase = createAdminClient();
  const [{ data, error }, staff] = await Promise.all([
    supabase.auth.admin.listUsers({ perPage: 1000 }),
    prisma.staff.findMany({ select: { name: true, role: true, supabaseUserId: true } }),
  ]);

  const staffBySupabaseId = Object.fromEntries(
    staff.filter((s) => s.supabaseUserId).map((s) => [s.supabaseUserId!, s])
  );

  const users = (data?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? "(no email)",
    lastSignIn: u.last_sign_in_at ?? null,
    staffName: staffBySupabaseId[u.id]?.name ?? null,
    staffRole: staffBySupabaseId[u.id]?.role ?? null,
  }));

  return { users, error: error?.message ?? null };
}
