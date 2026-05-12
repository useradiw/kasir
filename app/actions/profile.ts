"use server";

import { z } from "zod";
import { revalidateProfile } from "@/lib/revalidate";
import { requireAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { runAction } from "@/lib/action-error";

const nameSchema = z.object({
  name: z.string().min(1, "Nama tidak boleh kosong"),
});

export async function updateProfileName(formData: FormData) {
  return runAction(async () => {
    const staff = await requireAuth();
    const { name } = nameSchema.parse({ name: formData.get("name") });
    await prisma.staff.update({
      where: { id: staff.id },
      data: { name: name.trim() },
    });
    revalidateProfile();
  });
}
