"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import type { Staff, RoleEnum } from "@/generated/prisma";
import { isAllowed, type Capability } from "@/lib/permissions";

// Resolves the authenticated, active Staff record, or redirects to /.
async function resolveActiveStaff(): Promise<Staff> {
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

// Returns the authenticated Staff record if they have one of the given roles.
// DEVELOPER is a superuser and passes every role check (it is blocked only from
// hard-delete actions, which use requireRoleStrict / requireOwnerStrict instead).
// Redirects to / otherwise.
export async function requireRole(...roles: RoleEnum[]): Promise<Staff> {
  const staff = await resolveActiveStaff();

  if (staff.role !== "DEVELOPER" && !roles.includes(staff.role)) redirect("/");

  return staff;
}

// Like requireRole, but with NO DEVELOPER bypass — only the listed roles pass.
// Use this for hard-delete actions, which DEVELOPER must not be able to perform.
export async function requireRoleStrict(...roles: RoleEnum[]): Promise<Staff> {
  const staff = await resolveActiveStaff();

  if (!roles.includes(staff.role)) redirect("/");

  return staff;
}

// Convenience: require OWNER role specifically. DEVELOPER also passes.
export async function requireOwner(): Promise<Staff> {
  return requireRole("OWNER");
}

// Convenience: require OWNER specifically with NO DEVELOPER bypass.
// Use for OWNER-only hard-delete actions.
export async function requireOwnerStrict(): Promise<Staff> {
  return requireRoleStrict("OWNER");
}

// Any active authenticated staff member passes — no role check.
export async function requireAuth(): Promise<Staff> {
  return resolveActiveStaff();
}

// ---------------------------------------------------------------------------
// Capability gates.
//
// requireCan(cap) / requireCanStrict(cap) replace the role gates above. The
// role -> capability grid lives in lib/permissions.ts (DEFAULT_GRID) and, from
// phase 3, the RolePermission table overlays it. requireRole/requireOwner stay
// ONLY for the three privileged-role invariants in app/actions/admin/staff.ts,
// which are deliberately direct role comparisons — a capability is a grant the
// Owner can toggle, and those must not be toggleable.
// ---------------------------------------------------------------------------

// Returns the staff record if their role is granted the capability. OWNER is
// always allowed and DEVELOPER passes as a superuser — the same two flavours
// as requireRole / requireOwner. Redirects to / otherwise.
export async function requireCan(capability: Capability): Promise<Staff> {
  const staff = await resolveActiveStaff();
  if (!isAllowed(capability, staff.role)) redirect("/");
  return staff;
}

// Like requireCan, but with NO DEVELOPER bypass — used for hard deletes,
// exactly like the requireRoleStrict / requireOwnerStrict it replaces.
// DEVELOPER is not in DEFAULT_GRID, so a strict check never admits it.
export async function requireCanStrict(capability: Capability): Promise<Staff> {
  const staff = await resolveActiveStaff();
  if (!isAllowed(capability, staff.role, undefined, { strict: true })) redirect("/");
  return staff;
}

// Non-redirect variants for UI decisions (navigation, links). Same grid.
export async function canStaff(staff: Pick<Staff, "role">, capability: Capability): Promise<boolean> {
  return isAllowed(capability, staff.role);
}

// Returns minimal staff identity (id, name, role) for the authenticated user.
// Delegates to requireAuth() to avoid duplicating the auth check.
export async function getStaffIdentity() {
  const staff = await requireAuth();
  return { staffId: staff.id, staffName: staff.name, staffRole: staff.role };
}
