"use server";

import { revalidateCashRegister } from "@/lib/revalidate";
import { prisma } from "@/lib/prisma";
import { requireCan, requireCanStrict } from "@/lib/admin-auth";
import { z } from "zod";
import { ActionError, runAction } from "@/lib/action-error";
import { postDayCloseForRegister } from "@/lib/day-close-posting";
import { SalesPostingRepository } from "@/lib/accounting/salesPostingRepository";

const openSchema = z.object({
  openingCash: z.coerce.number().int().min(0, "Kas awal tidak boleh negatif"),
});

const closeSchema = z.object({
  closingCash: z.coerce.number().int().min(0, "Kas akhir tidak boleh negatif"),
});

export async function openRegister(formData: FormData) {
  return runAction(async () => {
    const staff = await requireCan("cashregister.write");
    const { openingCash } = openSchema.parse({ openingCash: formData.get("openingCash") });

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const existing = await prisma.cashRegister.findUnique({ where: { date: todayMidnight } });
    if (existing) throw new ActionError("Kas hari ini sudah dibuka.");

    await prisma.cashRegister.create({
      data: { date: todayMidnight, openingCash, openedById: staff.id },
    });
    revalidateCashRegister();
  });
}

export async function closeRegister(formData: FormData) {
  return runAction(async () => {
    const staff = await requireCan("cashregister.write");
    const { closingCash } = closeSchema.parse({ closingCash: formData.get("closingCash") });

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const register = await prisma.cashRegister.findUnique({ where: { date: todayMidnight } });
    if (!register) throw new ActionError("Kas hari ini belum dibuka.");
    if (register.closingCash !== null) throw new ActionError("Kas hari ini sudah ditutup.");

    await prisma.cashRegister.update({
      where: { id: register.id },
      data: { closingCash, closedById: staff.id },
    });
    revalidateCashRegister();

    // Post to the buku besar AFTER the register is closed — never blocks the
    // close itself (failure is swallowed inside, owners get notified).
    await postDayCloseForRegister(register.id);
  });
}

const editSchema = z.object({
  openingCash: z.coerce.number().int().min(0, "Kas awal tidak boleh negatif"),
  closingCash: z.coerce.number().int().min(0, "Kas akhir tidak boleh negatif").optional(),
});

export async function editRegister(id: string, formData: FormData) {
  return runAction(async () => {
    const staff = await requireCan("cashregister.write");
    const raw: Record<string, unknown> = { openingCash: formData.get("openingCash") };
    const closingVal = formData.get("closingCash");
    if (closingVal !== null && closingVal !== "") raw.closingCash = closingVal;

    const parsed = editSchema.parse(raw);
    const closingCash = parsed.closingCash;
    const updated = await prisma.cashRegister.update({
      where: { id },
      data: {
        openingCash: parsed.openingCash,
        ...(closingCash !== undefined ? { closingCash, closedById: staff.id } : {}),
        editedById: staff.id,
        editedAt: new Date(),
      },
    });
    revalidateCashRegister();

    // openingCash/closingCash changed -> the expected/counted numbers changed.
    // Repost only when the register is closed AND already has a posting;
    // never blocks the edit itself.
    if (updated.closingCash !== null) {
      const existingPosting = await new SalesPostingRepository(prisma).getPostingFor(updated.id);
      if (existingPosting) {
        await postDayCloseForRegister(updated.id, { repost: true });
      }
    }
  });
}

export async function deleteRegister(id: string) {
  return runAction(async () => {
    await requireCanStrict("cashregister.delete");

    const sales = new SalesPostingRepository(prisma);
    const existingPosting = await sales.getPostingFor(id);
    if (existingPosting) {
      // Void the ledger entry BEFORE deleting the register row — the
      // reversal stays in the ledger; only the correlation row goes.
      await sales.voidDayClose(id);
    }

    await prisma.cashRegister.delete({ where: { id } });
    revalidateCashRegister();
  });
}
