"use server";

import { prisma } from "@/lib/prisma";
import { requireCanStrict } from "@/lib/admin-auth";
import { invalidatePermissionCache } from "@/lib/permission-store";
import { revalidatePermissions } from "@/lib/revalidate";
import { ActionError, runAction } from "@/lib/action-error";
import {
  DEFAULT_GRID,
  TOGGLEABLE_ROLES,
  isCapability,
  type Capability,
} from "@/lib/permissions";
import type { RoleEnum } from "@/generated/prisma";

/**
 * /buku/izin actions — the Owner's permission toggle screen.
 *
 * Guard rails (not negotiable, see docs/prompts/role-permissions-zcode.md):
 * - Every write is real-OWNER only, with NO DEVELOPER bypass. The gate is
 *   requireCanStrict("permissions.manage") — DEVELOPER is not in that
 *   capability's grid, so a strict check never admits it — and the actor's
 *   real role is checked again below, exactly like assertMayChangePrivilegedRole
 *   in app/actions/admin/staff.ts. If the Owner ever toggles the capability
 *   grid to grant someone else, writes STILL refuse anyone but a real OWNER.
 * - The OWNER and DEVELOPER rows are not editable. An Owner who could revoke
 *   their own staff.write could never restore it — there is no second Owner to
 *   repair the shop. Such a write fails LOUD (ActionError), never silently.
 */

export async function setPermission(role: RoleEnum, capability: string, allowed: boolean) {
  return runAction(async () => {
    const actor = await requireCanStrict("permissions.manage");
    if (actor.role !== "OWNER") {
      throw new ActionError("Hanya Owner yang dapat mengubah izin peran.");
    }
    if (!isCapability(capability)) {
      throw new ActionError("Izin tidak dikenal.");
    }
    if (!TOGGLEABLE_ROLES.includes(role)) {
      throw new ActionError("Baris Owner dan Developer tidak dapat diubah.");
    }

    const cap = capability as Capability;
    // The table is a MINIMAL override layer: writing the default value deletes
    // the row, so the fallback path (missing row -> DEFAULT_GRID) stays live
    // and the table never drifts into a shadow copy of the whole grid.
    if (allowed === DEFAULT_GRID[cap].includes(role)) {
      await prisma.rolePermission.deleteMany({ where: { role, capability: cap } });
    } else {
      await prisma.rolePermission.upsert({
        where: { role_capability: { role, capability: cap } },
        create: { role, capability: cap, allowed },
        update: { allowed },
      });
    }
    invalidatePermissionCache();
    revalidatePermissions();
  });
}

export async function resetRolePermissions(role: RoleEnum) {
  return runAction(async () => {
    const actor = await requireCanStrict("permissions.manage");
    if (actor.role !== "OWNER") {
      throw new ActionError("Hanya Owner yang dapat mengubah izin peran.");
    }
    if (!TOGGLEABLE_ROLES.includes(role)) {
      throw new ActionError("Baris Owner dan Developer tidak dapat diubah.");
    }
    await prisma.rolePermission.deleteMany({ where: { role } });
    invalidatePermissionCache();
    revalidatePermissions();
  });
}
