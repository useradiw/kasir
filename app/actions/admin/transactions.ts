"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { ActionError } from "@/lib/action-error";
import { createVoidNotification } from "@/lib/notifications";
import { formatRupiah } from "@/lib/format";

export async function voidTransaction(transactionId: string, reason: string) {
  const staff = await requireOwner();

  if (!reason.trim()) throw new ActionError("Alasan void wajib diisi.");

  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) throw new ActionError("Transaksi tidak ditemukan.");
  if (tx.status === "VOIDED") throw new ActionError("Transaksi sudah di-void.");

  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      status: "VOIDED",
      voidedById: staff.id,
      voidedAt: new Date(),
      voidReason: reason.trim(),
    },
  });

  await createVoidNotification({
    type: "TRANSACTION_VOIDED",
    actorName: staff.name,
    actorId: staff.id,
    subjectLabel: `Transaksi ${formatRupiah(tx.totalAmount)}`,
    reason: reason.trim(),
    metadata: { transactionId, tableSessionId: tx.tableSessionId },
  });

  revalidatePath("/admin/transactions");
  revalidatePath("/admin/notifications");
}

// ─── Update Transaction (Owner Edit) ────────────────────────────────────────

export interface UpdateTransactionInput {
  // Session fields
  customerAlias?: string | null;
  customerPhone?: string | null;
  service?: string | null;
  // Order item updates: { itemId -> { qty, price, note } }
  orderItems?: Array<{
    id: string;
    qty: number;
    price: number;
    note: string | null;
  }>;
  // Charge overrides
  taxAmount?: number;
  serviceCharge?: number;
  discountAmount?: number;
}

export async function updateTransaction(
  transactionId: string,
  input: UpdateTransactionInput
) {
  await requireOwner();

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      tableSession: {
        include: { orderItems: true },
      },
    },
  });

  if (!tx) throw new Error("Transaksi tidak ditemukan.");

  await prisma.$transaction(async (p) => {
    // Update session fields
    const sessionUpdates: Record<string, unknown> = {};
    if (input.customerAlias !== undefined) sessionUpdates.customerAlias = input.customerAlias;
    if (input.customerPhone !== undefined) sessionUpdates.customerPhone = input.customerPhone;
    if (input.service !== undefined) sessionUpdates.service = input.service;
    if (Object.keys(sessionUpdates).length > 0) {
      await p.tableSession.update({
        where: { id: tx.tableSessionId },
        data: sessionUpdates,
      });
    }

    // Update order items
    if (input.orderItems) {
      for (const item of input.orderItems) {
        await p.orderItem.update({
          where: { id: item.id },
          data: { qty: item.qty, price: item.price, note: item.note },
        });
      }
    }

    // Recalculate totals
    const orderItems = input.orderItems ?? tx.tableSession.orderItems.map((oi) => ({
      id: oi.id,
      qty: oi.qty,
      price: oi.price,
      note: oi.note,
      status: oi.status,
    }));

    const activeItems = orderItems.filter((oi) => {
      const original = tx.tableSession.orderItems.find((o) => o.id === oi.id);
      return original ? original.status !== "CANCELLED" : true;
    });

    const subtotal = activeItems.reduce((sum, oi) => sum + oi.qty * oi.price, 0);
    const taxAmount = input.taxAmount ?? tx.taxAmount;
    const serviceCharge = input.serviceCharge ?? tx.serviceCharge;
    const discountAmount = input.discountAmount ?? tx.discountAmount;
    const totalAmount = subtotal + taxAmount + serviceCharge - discountAmount;

    await p.transaction.update({
      where: { id: transactionId },
      data: {
        subtotal,
        taxAmount,
        serviceCharge,
        discountAmount,
        totalAmount,
      },
    });
  });

  revalidatePath("/admin/transactions");
  revalidatePath(`/admin/transactions/${transactionId}`);
}
