"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import type { Staff } from "@/generated/prisma";
import { type Capability } from "@/lib/permissions";
import { canByGrid } from "@/lib/permission-store";

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

// Any active authenticated staff member passes — no role check.
export async function requireAuth(): Promise<Staff> {
  return resolveActiveStaff();
}

// ---------------------------------------------------------------------------
// Capability gates.
//
// The old role gates (requireRole / requireOwner and their Strict variants)
// are gone: every gate in the app is a capability now. The role -> capability
// grid lives in lib/permissions.ts (DEFAULT_GRID) and, since the RolePermission
// table exists, overlays it. The three privileged-role invariants in
// app/actions/admin/staff.ts are deliberately DIRECT actor.role comparisons —
// a capability is a grant the Owner can toggle, and those invariants must not
// be toggleable. test/permissions-matrix.test.ts pins both.
// ---------------------------------------------------------------------------

// Returns the staff record if their role is granted the capability. OWNER is
// always allowed and DEVELOPER passes as a superuser — the same two flavours
// as the old requireRole / requireOwner. Redirects to / otherwise.
export async function requireCan(capability: Capability): Promise<Staff> {
  const staff = await resolveActiveStaff();
  if (!(await canByGrid(capability, staff.role))) redirect("/");
  return staff;
}

// Like requireCan, but with NO DEVELOPER bypass — used for hard deletes,
// exactly like the requireRoleStrict / requireOwnerStrict it replaced.
// DEVELOPER is not in DEFAULT_GRID, so a strict check never admits it.
export async function requireCanStrict(capability: Capability): Promise<Staff> {
  const staff = await resolveActiveStaff();
  if (!(await canByGrid(capability, staff.role, { strict: true }))) redirect("/");
  return staff;
}

// Non-redirect variants for UI decisions (navigation, links). Same grid.
export async function canStaff(staff: Pick<Staff, "role">, capability: Capability): Promise<boolean> {
  return canByGrid(capability, staff.role);
}

// Returns minimal staff identity (id, name, role) for the authenticated user.
// Delegates to requireAuth() to avoid duplicating the auth check.
export async function getStaffIdentity() {
  const staff = await requireAuth();
  return { staffId: staff.id, staffName: staff.name, staffRole: staff.role };
}
