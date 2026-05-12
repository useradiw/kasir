"use server";

import { revalidateCashRegister } from "@/lib/revalidate";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { z } from "zod";
import { runAction } from "@/lib/action-error";

const openSchema = z.object({
  openingCash: z.coerce.number().int().min(0, "Kas awal tidak boleh negatif"),
});

const closeSchema = z.object({
  closingCash: z.coerce.number().int().min(0, "Kas akhir tidak boleh negatif"),
});

export async function openRegister(formData: FormData) {
  return runAction(async () => {
    const staff = await requireOwner();
    const { openingCash } = openSchema.parse({ openingCash: formData.get("openingCash") });

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const existing = await prisma.cashRegister.findUnique({ where: { date: todayMidnight } });
    if (existing) throw new Error("Kas hari ini sudah dibuka.");

    await prisma.cashRegister.create({
      data: { date: todayMidnight, openingCash, openedById: staff.id },
    });
    revalidateCashRegister();
  });
}

export async function closeRegister(formData: FormData) {
  return runAction(async () => {
    const staff = await requireOwner();
    const { closingCash } = closeSchema.parse({ closingCash: formData.get("closingCash") });

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const register = await prisma.cashRegister.findUnique({ where: { date: todayMidnight } });
    if (!register) throw new Error("Kas hari ini belum dibuka.");
    if (register.closingCash !== null) throw new Error("Kas hari ini sudah ditutup.");

    await prisma.cashRegister.update({
      where: { id: register.id },
      data: { closingCash, closedById: staff.id },
    });
    revalidateCashRegister();
  });
}

const editSchema = z.object({
  openingCash: z.coerce.number().int().min(0, "Kas awal tidak boleh negatif"),
  closingCash: z.coerce.number().int().min(0, "Kas akhir tidak boleh negatif").optional(),
});

export async function editRegister(id: string, formData: FormData) {
  return runAction(async () => {
    const staff = await requireOwner();
    const raw: Record<string, unknown> = { openingCash: formData.get("openingCash") };
    const closingVal = formData.get("closingCash");
    if (closingVal !== null && closingVal !== "") raw.closingCash = closingVal;

    const parsed = editSchema.parse(raw);
    const closingCash = parsed.closingCash;
    await prisma.cashRegister.update({
      where: { id },
      data: {
        openingCash: parsed.openingCash,
        ...(closingCash !== undefined ? { closingCash, closedById: staff.id } : {}),
        editedById: staff.id,
        editedAt: new Date(),
      },
    });
    revalidateCashRegister();
  });
}

export async function deleteRegister(id: string) {
  return runAction(async () => {
    await requireOwner();
    await prisma.cashRegister.delete({ where: { id } });
    revalidateCashRegister();
  });
}
