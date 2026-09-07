"use server";

import { revalidateStaff } from "@/lib/revalidate";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireOwner, requireOwnerStrict } from "@/lib/admin-auth";
import { z } from "zod";
import type { RoleEnum, Staff } from "@/generated/prisma";
import { ActionError, runAction } from "@/lib/action-error";

const staffSchema = z.object({
  username: z.string().min(1, "Username tidak boleh kosong")
    .regex(/^[a-zA-Z0-9._-]+$/, "Username hanya boleh huruf, angka, titik, underscore, dan strip"),
  name: z.string().min(1, "Nama tidak boleh kosong"),
  role: z.enum(["OWNER", "MANAGER", "CASHIER", "STAFF", "DEVELOPER"]),
  salary: z.coerce.number().int().min(0).nullable().optional(),
});

/**
 * OWNER and DEVELOPER are the two privileged roles, and only a real OWNER may
 * grant or revoke either one.
 *
 * Every action in this file gates on requireOwner(), which deliberately lets a
 * DEVELOPER through as a superuser. That bypass exists for support work, not
 * for handing out ownership of the business, so a change that touches a
 * privileged role is checked again here against the actor's real role.
 *
 * Both directions are guarded, and for both roles. Promotion is the obvious
 * one. Demotion matters just as much: a DEVELOPER who could demote the OWNER
 * would lock the real owner out of the shop, and a DEVELOPER who could mint
 * another DEVELOPER would make the superuser role self-propagating.
 */
const PRIVILEGED_ROLES: RoleEnum[] = ["OWNER", "DEVELOPER"];

/**
 * Nobody changes their own role, and nobody deactivates their own account.
 *
 * This mirrors the existing self-delete guard in deleteStaff(). All three are
 * the same failure: the last Owner strips their own access and the shop has no
 * Owner left, with no second account able to restore one. A role change is a
 * demotion in practice — there is nothing above Owner to promote yourself to.
 */
function assertNotSelfLockout(actor: Staff, targetId: string, nextRole: RoleEnum) {
  if (actor.id !== targetId) return;
  if (nextRole !== actor.role) {
    throw new ActionError("Tidak dapat mengubah peran akun sendiri. Minta Owner lain yang melakukannya.");
  }
}

function assertMayChangePrivilegedRole(
  actor: Staff,
  nextRole: RoleEnum,
  currentRole?: RoleEnum,
) {
  const touchesPrivileged =
    PRIVILEGED_ROLES.includes(nextRole) ||
    (currentRole !== undefined && PRIVILEGED_ROLES.includes(currentRole));
  if (!touchesPrivileged) return;
  if (actor.role !== "OWNER") {
    throw new ActionError("Hanya Owner yang dapat memberi atau mencabut peran Owner dan Developer.");
  }
}

export async function addStaff(formData: FormData) {
  return runAction(async () => {
    const actor = await requireOwner();
    const salaryRaw = formData.get("salary");
    const data = staffSchema.parse({
      username: formData.get("username"),
      name: formData.get("name"),
      role: formData.get("role"),
      salary: salaryRaw ? Number(salaryRaw) : null,
    });
    assertMayChangePrivilegedRole(actor, data.role as RoleEnum);
    await prisma.staff.create({
      data: { username: data.username, name: data.name, role: data.role as RoleEnum, salary: data.salary ?? null },
    });
    revalidateStaff();
  });
}

export async function updateStaff(id: string, formData: FormData) {
  return runAction(async () => {
    const actor = await requireOwner();
    const salaryRaw = formData.get("salary");
    const data = staffSchema.parse({
      username: formData.get("username"),
      name: formData.get("name"),
      role: formData.get("role"),
      salary: salaryRaw ? Number(salaryRaw) : null,
    });
    const target = await prisma.staff.findUnique({ where: { id }, select: { role: true } });
    if (!target) throw new ActionError("Staff tidak ditemukan.");
    assertNotSelfLockout(actor, id, data.role as RoleEnum);
    assertMayChangePrivilegedRole(actor, data.role as RoleEnum, target.role);
    await prisma.staff.update({
      where: { id },
      data: { username: data.username, name: data.name, role: data.role as RoleEnum, salary: data.salary ?? null },
    });
    revalidateStaff();
  });
}

export async function deleteStaff(id: string) {
  return runAction(async () => {
    const owner = await requireOwnerStrict();

    if (owner.id === id) throw new ActionError("Tidak dapat menghapus akun sendiri.");

    const staff = await prisma.staff.findUnique({ where: { id } });
    if (!staff) throw new ActionError("Staff tidak ditemukan.");

    // Clean up references before deleting
    await prisma.$transaction([
      // Reassign processedById to the acting owner (processedById is required)
      prisma.transaction.updateMany({
        where: { processedById: id },
        data: { processedById: owner.id },
      }),
      // Nullify voidedById on transactions voided by this staff
      prisma.transaction.updateMany({
        where: { voidedById: id },
        data: { voidedById: null },
      }),
      // Delete the staff record (TableSession.ownerId auto-nullified via FK SetNull,
      // AttendanceRecord cascade-deleted via onDelete: Cascade)
      prisma.staff.delete({ where: { id } }),
    ]);

    // Disable the Supabase account if linked
    if (staff.supabaseUserId) {
      const supabase = createAdminClient();
      await supabase.auth.admin.updateUserById(staff.supabaseUserId, {
        ban_duration: "876600h", // ~100 years, effectively permanent
      });
    }

    revalidateStaff();
  });
}

export async function toggleStaffActive(id: string, current: boolean) {
  return runAction(async () => {
    const actor = await requireOwner();
    if (actor.id === id) {
      throw new ActionError("Tidak dapat menonaktifkan akun sendiri.");
    }
    const target = await prisma.staff.findUnique({ where: { id }, select: { role: true } });
    if (!target) throw new ActionError("Staff tidak ditemukan.");
    // Deactivating a privileged account locks it out exactly as revoking the
    // role would (resolveActiveStaff redirects inactive staff), so it gets the
    // same gate.
    if (PRIVILEGED_ROLES.includes(target.role) && actor.role !== "OWNER") {
      throw new ActionError("Hanya Owner yang dapat menonaktifkan akun Owner atau Developer.");
    }
    await prisma.staff.update({
      where: { id },
      data: { isActive: !current },
    });
    revalidateStaff();
  });
}

export async function linkSupabaseUser(staffId: string, email: string) {
  return runAction(async () => {
    await requireOwner();

    const supabase = createAdminClient();
    const { data: listData, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });

    if (error) {
      throw new ActionError("Gagal mengambil data pengguna Supabase.");
    }

    const found = listData.users.find((u) => u.email === email.trim());
    if (!found) {
      throw new ActionError("Pengguna dengan email tersebut tidak ditemukan di Supabase.");
    }

    const alreadyLinked = await prisma.staff.findUnique({
      where: { supabaseUserId: found.id },
    });
    if (alreadyLinked && alreadyLinked.id !== staffId) {
      throw new ActionError("Akun Supabase ini sudah terhubung ke staff lain.");
    }

    await prisma.staff.update({
      where: { id: staffId },
      data: { supabaseUserId: found.id },
    });
    revalidateStaff();
  });
}

export async function unlinkSupabaseUser(staffId: string) {
  return runAction(async () => {
    await requireOwner();
    await prisma.staff.update({
      where: { id: staffId },
      data: { supabaseUserId: null },
    });
    revalidateStaff();
  });
}
