"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { ActionError, actionError } from "@/lib/action-error";
import { createVoidNotification, notifyStaff } from "@/lib/notifications";
import type { NotificationType } from "@/generated/prisma";

const testSchema = z.object({
  type: z.enum(["TRANSACTION_VOIDED", "SESSION_VOIDED", "TEST"]),
  title: z.string().min(1, "Judul wajib diisi.").max(200),
  body: z.string().min(1, "Isi wajib diisi.").max(500),
  recipientId: z.string().min(1, "Penerima wajib dipilih."),
});

export async function createTestNotification(formData: FormData) {
  await requireOwner();
  const parsed = testSchema.safeParse({
    type: formData.get("type"),
    title: formData.get("title"),
    body: formData.get("body"),
    recipientId: formData.get("recipientId"),
  });
  if (!parsed.success) actionError.fromZod(parsed.error);
  const data = parsed.data!;

  const recipient = await prisma.staff.findUnique({
    where: { id: data.recipientId },
    select: { id: true, isActive: true },
  });
  if (!recipient || !recipient.isActive) {
    throw new ActionError("Penerima tidak ditemukan atau nonaktif.");
  }

  await notifyStaff(recipient.id, {
    type: data.type as NotificationType,
    title: data.title,
    body: data.body,
    metadata: { test: true },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/notifications");
}

export async function triggerSampleVoidNotification() {
  const owner = await requireOwner();
  await createVoidNotification({
    type: "TRANSACTION_VOIDED",
    actorName: owner.name,
    actorId: null,
    subjectLabel: "Contoh transaksi uji (Rp 50.000)",
    reason: "Ini hanya uji coba dari halaman notifikasi.",
    metadata: { sample: true },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/notifications");
}

export async function markAllNotificationsReadGlobal() {
  await requireOwner();
  await prisma.notification.updateMany({
    where: { readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/notifications");
}

export async function deleteNotification(id: string) {
  await requireOwner();
  try {
    await prisma.notification.delete({ where: { id } });
  } catch (e) {
    actionError.fromPrisma(e);
  }
  revalidatePath("/admin");
  revalidatePath("/admin/notifications");
}
