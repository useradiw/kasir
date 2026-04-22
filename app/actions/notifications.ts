"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/admin-auth";

export async function markNotificationRead(id: string) {
  const staff = await requireAuth();
  await prisma.notification.updateMany({
    where: { id, recipientId: staff.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/notifications");
}

export async function markAllNotificationsRead() {
  const staff = await requireAuth();
  await prisma.notification.updateMany({
    where: { recipientId: staff.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/notifications");
}
