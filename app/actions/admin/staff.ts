"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireOwner } from "@/lib/admin-auth";
import { z } from "zod";
import type { RoleEnum } from "@/generated/prisma";

const staffSchema = z.object({
  username: z.string().min(1, "Username tidak boleh kosong")
    .regex(/^[a-zA-Z0-9._-]+$/, "Username hanya boleh huruf, angka, titik, underscore, dan strip"),
  name: z.string().min(1, "Nama tidak boleh kosong"),
  role: z.enum(["OWNER", "MANAGER", "CASHIER", "STAFF"]),
});

export async function addStaff(formData: FormData) {
  await requireOwner();

  const parsed = staffSchema.safeParse({
    username: formData.get("username"),
    name: formData.get("name"),
    role: formData.get("role"),
  });
  if (!parsed.success) throw new Error(parsed.error.flatten().formErrors[0]);

  await prisma.staff.create({
    data: { username: parsed.data.username, name: parsed.data.name, role: parsed.data.role as RoleEnum },
  });
  revalidatePath("/admin/staff");
}

export async function updateStaff(id: string, formData: FormData) {
  await requireOwner();

  const parsed = staffSchema.safeParse({
    username: formData.get("username"),
    name: formData.get("name"),
    role: formData.get("role"),
  });
  if (!parsed.success) throw new Error(parsed.error.flatten().formErrors[0]);

  await prisma.staff.update({
    where: { id },
    data: { username: parsed.data.username, name: parsed.data.name, role: parsed.data.role as RoleEnum },
  });
  revalidatePath("/admin/staff");
}

export async function deleteStaff(id: string) {
  const owner = await requireOwner();

  if (owner.id === id) throw new Error("Tidak dapat menghapus akun sendiri.");

  const staff = await prisma.staff.findUnique({ where: { id } });
  if (!staff) throw new Error("Staff tidak ditemukan.");

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

  revalidatePath("/admin/staff");
}

export async function toggleStaffActive(id: string, current: boolean) {
  await requireOwner();
  await prisma.staff.update({
    where: { id },
    data: { isActive: !current },
  });
  revalidatePath("/admin/staff");
}

export async function linkSupabaseUser(staffId: string, email: string) {
  await requireOwner();

  const supabase = createAdminClient();
  const { data: listData, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });

  if (error) {
    throw new Error("Gagal mengambil data pengguna Supabase.");
  }

  const found = listData.users.find((u) => u.email === email.trim());
  if (!found) {
    throw new Error("Pengguna dengan email tersebut tidak ditemukan di Supabase.");
  }

  const alreadyLinked = await prisma.staff.findUnique({
    where: { supabaseUserId: found.id },
  });
  if (alreadyLinked && alreadyLinked.id !== staffId) {
    throw new Error("Akun Supabase ini sudah terhubung ke staff lain.");
  }

  await prisma.staff.update({
    where: { id: staffId },
    data: { supabaseUserId: found.id },
  });
  revalidatePath("/admin/staff");
}

export async function unlinkSupabaseUser(staffId: string) {
  await requireOwner();
  await prisma.staff.update({
    where: { id: staffId },
    data: { supabaseUserId: null },
  });
  revalidatePath("/admin/staff");
}
