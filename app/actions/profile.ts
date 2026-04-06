"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const nameSchema = z.object({
  name: z.string().min(1, "Nama tidak boleh kosong"),
});

export async function updateProfileName(formData: FormData) {
  const staff = await requireAuth();

  const parsed = nameSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msg = flat.formErrors[0] ?? flat.fieldErrors.name?.[0] ?? "Data tidak valid";
    throw new Error(msg);
  }

  await prisma.staff.update({
    where: { id: staff.id },
    data: { name: parsed.data.name.trim() },
  });

  revalidatePath("/profile");
  revalidatePath("/");
}
