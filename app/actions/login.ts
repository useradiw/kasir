"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { redirect } from "next/navigation";

const masukSchema = z.object({
  username: z.string().min(1, { message: "Username tidak boleh kosong." }),
  password: z.string().min(1, { message: "Password tidak boleh kosong." }),
});

export async function login(formData: FormData) {
  const parsed = masukSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const message = Object.values(errors).flat().join(", ");
    throw new Error(message);
  }

  const staff = await prisma.staff.findUnique({
    where: { username: parsed.data.username },
  });

  if (!staff || !staff.supabaseUserId) {
    throw new Error("Username tidak ditemukan.");
  }

  if (!staff.isActive) {
    throw new Error("Akun staff tidak aktif.");
  }

  const adminSupabase = createAdminClient();
  const { data: userData, error: userError } =
    await adminSupabase.auth.admin.getUserById(staff.supabaseUserId);

  if (userError || !userData.user?.email) {
    throw new Error("Gagal mengambil data akun.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: userData.user.email,
    password: parsed.data.password,
  });

  if (error) {
    throw new Error("Password salah.");
  }

  redirect("/");
}
