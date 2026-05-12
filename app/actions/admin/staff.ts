"use server";

import { revalidateStaff } from "@/lib/revalidate";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireOwner } from "@/lib/admin-auth";
import { z } from "zod";
import type { RoleEnum } from "@/generated/prisma";
import { ActionError, runAction } from "@/lib/action-error";

const staffSchema = z.object({
  username: z.string().min(1, "Username tidak boleh kosong")
    .regex(/^[a-zA-Z0-9._-]+$/, "Username hanya boleh huruf, angka, titik, underscore, dan strip"),
  name: z.string().min(1, "Nama tidak boleh kosong"),
  role: z.enum(["OWNER", "MANAGER", "CASHIER", "STAFF"]),
  salary: z.coerce.number().int().min(0).nullable().optional(),
});

export async function addStaff(formData: FormData) {
  return runAction(async () => {
    await requireOwner();
    const salaryRaw = formData.get("salary");
    const data = staffSchema.parse({
      username: formData.get("username"),
      name: formData.get("name"),
      role: formData.get("role"),
      salary: salaryRaw ? Number(salaryRaw) : null,
    });
    await prisma.staff.create({
      data: { username: data.username, name: data.name, role: data.role as RoleEnum, salary: data.salary ?? null },
    });
    revalidateStaff();
  });
}

export async function updateStaff(id: string, formData: FormData) {
  return runAction(async () => {
    await requireOwner();
    const salaryRaw = formData.get("salary");
    const data = staffSchema.parse({
      username: formData.get("username"),
      name: formData.get("name"),
      role: formData.get("role"),
      salary: salaryRaw ? Number(salaryRaw) : null,
    });
    await prisma.staff.update({
      where: { id },
      data: { username: data.username, name: data.name, role: data.role as RoleEnum, salary: data.salary ?? null },
    });
    revalidateStaff();
  });
}

export async function deleteStaff(id: string) {
  return runAction(async () => {
    const owner = await requireOwner();

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
    await requireOwner();
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
