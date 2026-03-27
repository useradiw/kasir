"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { z } from "zod";

const openSchema = z.object({
  openingCash: z.coerce.number().int().min(0, "Kas awal tidak boleh negatif"),
});

const closeSchema = z.object({
  closingCash: z.coerce.number().int().min(0, "Kas akhir tidak boleh negatif"),
});

export async function openRegister(formData: FormData) {
  await requireOwner();

  const parsed = openSchema.safeParse({ openingCash: formData.get("openingCash") });
  if (!parsed.success) throw new Error(Object.values(parsed.error.flatten().fieldErrors).flat()[0]);

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const existing = await prisma.cashRegister.findUnique({ where: { date: todayMidnight } });
  if (existing) throw new Error("Kas hari ini sudah dibuka.");

  await prisma.cashRegister.create({
    data: { date: todayMidnight, openingCash: parsed.data.openingCash },
  });
  revalidatePath("/admin/cash-register");
}

export async function closeRegister(formData: FormData) {
  await requireOwner();

  const parsed = closeSchema.safeParse({ closingCash: formData.get("closingCash") });
  if (!parsed.success) throw new Error(Object.values(parsed.error.flatten().fieldErrors).flat()[0]);

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const register = await prisma.cashRegister.findUnique({ where: { date: todayMidnight } });
  if (!register) throw new Error("Kas hari ini belum dibuka.");
  if (register.closingCash !== null) throw new Error("Kas hari ini sudah ditutup.");

  await prisma.cashRegister.update({
    where: { id: register.id },
    data: { closingCash: parsed.data.closingCash },
  });
  revalidatePath("/admin/cash-register");
}

const editSchema = z.object({
  openingCash: z.coerce.number().int().min(0, "Kas awal tidak boleh negatif"),
  closingCash: z.coerce.number().int().min(0, "Kas akhir tidak boleh negatif").optional(),
});

export async function editRegister(id: string, formData: FormData) {
  await requireOwner();

  const raw: Record<string, unknown> = { openingCash: formData.get("openingCash") };
  const closingVal = formData.get("closingCash");
  if (closingVal !== null && closingVal !== "") raw.closingCash = closingVal;

  const parsed = editSchema.safeParse(raw);
  if (!parsed.success) throw new Error(Object.values(parsed.error.flatten().fieldErrors).flat()[0]);

  await prisma.cashRegister.update({
    where: { id },
    data: {
      openingCash: parsed.data.openingCash,
      ...(parsed.data.closingCash !== undefined ? { closingCash: parsed.data.closingCash } : {}),
    },
  });
  revalidatePath("/admin/cash-register");
}

export async function deleteRegister(id: string) {
  await requireOwner();
  await prisma.cashRegister.delete({ where: { id } });
  revalidatePath("/admin/cash-register");
}
