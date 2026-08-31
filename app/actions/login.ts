"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { redirect } from "next/navigation";

/** One message for every credential failure, so nothing reveals whether it was
 *  the username or the password that was wrong. */
const INVALID_CREDENTIALS = "Username atau password salah.";

const masukSchema = z.object({
  username: z.string().min(1, { message: "Username tidak boleh kosong." }),
  password: z.string().min(1, { message: "Password tidak boleh kosong." }),
});

/**
 * Failures are RETURNED as data, never thrown: Next.js redacts the message of
 * any thrown server-action error to a generic digest in production, so a
 * thrown "Username atau password salah." would never reach the user. The
 * client raises the returned message locally instead. redirect() on success
 * still throws intentionally — that one is a navigation signal, not copy.
 */
export async function login(formData: FormData): Promise<{ error?: string }> {
  const parsed = masukSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { error: Object.values(errors).flat().join(", ") };
  }

  const staff = await prisma.staff.findUnique({
    where: { username: parsed.data.username },
  });

  // Every credential failure below returns the SAME message. Saying "Username
  // tidak ditemukan." vs "Password salah." let anyone probe which usernames
  // exist just by trying names — an account-enumeration leak. The empty-field
  // messages above are fine to keep: they describe the form, not the account.
  if (!staff || !staff.supabaseUserId) {
    return { error: INVALID_CREDENTIALS };
  }

  const adminSupabase = createAdminClient();
  const { data: userData, error: userError } =
    await adminSupabase.auth.admin.getUserById(staff.supabaseUserId);

  if (userError || !userData.user?.email) {
    return { error: INVALID_CREDENTIALS };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: userData.user.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: INVALID_CREDENTIALS };
  }

  // isActive is checked AFTER the password is verified, deliberately. Checking
  // it earlier told an attacker the username was real without needing the
  // password. Here, only someone who already has the correct credentials sees
  // it — so a deactivated staff member still gets a message that explains what
  // happened, without leaking anything to anyone else.
  if (!staff.isActive) {
    // signInWithPassword already issued a session cookie; drop it, otherwise a
    // deactivated account would stay logged in despite this error.
    await supabase.auth.signOut();
    return { error: "Akun staff ini sudah tidak aktif. Hubungi pemilik." };
  }

  redirect("/");
}
