"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";

export async function voidTransaction(transactionId: string, reason: string) {
  const staff = await requireOwner();

  if (!reason.trim()) throw new Error("Alasan void wajib diisi.");

  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) throw new Error("Transaksi tidak ditemukan.");
  if (tx.status === "VOIDED") throw new Error("Transaksi sudah di-void.");

  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      status: "VOIDED",
      voidedById: staff.id,
      voidedAt: new Date(),
      voidReason: reason.trim(),
    },
  });

  revalidatePath("/admin/transactions");
}
