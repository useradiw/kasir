"use server";

import { prisma } from "@/lib/prisma";
import type { TableSession, OrderItem, Transaction } from "@/lib/db";
import { createVoidNotification } from "@/lib/notifications";
import { computeOrderCogs, applyStockMovements } from "@/lib/cogs-utils";

export interface TransactionPayload {
  session: TableSession;
  orderItems: OrderItem[];
  transaction: Transaction;
}

export async function pushTransaction(payload: TransactionPayload): Promise<void> {
  const { session, orderItems, transaction } = payload;

  // Validate: each OrderItem must have exactly one of menuItemId or packageId
  for (const item of orderItems) {
    if (item.menuItemId && item.packageId) {
      throw new Error(`OrderItem ${item.id}: cannot have both menuItemId and packageId`);
    }
    if (!item.menuItemId && !item.packageId) {
      throw new Error(`OrderItem ${item.id}: must have either menuItemId or packageId`);
    }
  }

  await prisma.$transaction(async (tx) => {
    // ── Upsert table session ───────────────────────────────────────────────
    await tx.tableSession.upsert({
      where: { id: session.id },
      create: {
        id: session.id,
        name: session.name,
        service: session.service ?? undefined,
        externalOrderId: session.externalOrderId ?? null,
        customerAlias: session.customerAlias,
        customerPhone: session.customerPhone,
        ownerId: session.ownerId ?? undefined,
        orderedAt: session.orderedAt ? new Date(session.orderedAt) : null,
        servedAt: session.servedAt ? new Date(session.servedAt) : null,
        paidAt: session.paidAt ? new Date(session.paidAt) : null,
        erasedAt: session.erasedAt ? new Date(session.erasedAt) : null,
        createdAt: new Date(session.createdAt),
      },
      update: {
        name: session.name,
        externalOrderId: session.externalOrderId ?? null,
        paidAt: session.paidAt ? new Date(session.paidAt) : null,
        servedAt: session.servedAt ? new Date(session.servedAt) : null,
        erasedAt: session.erasedAt ? new Date(session.erasedAt) : null,
      },
    });

    // ── Upsert order items ─────────────────────────────────────────────────
    for (const item of orderItems) {
      await tx.orderItem.upsert({
        where: { id: item.id },
        create: {
          id: item.id,
          tableSessionId: item.tableSessionId,
          menuItemId: item.menuItemId,
          packageId: item.packageId,
          variantId: item.variantId,
          qty: item.qty,
          note: item.note,
          status: item.status,
          nameSnapshot: item.nameSnapshot,
          price: item.price,
          splitGroup: item.splitGroup ?? 0,
          preparedAt: item.preparedAt ? new Date(item.preparedAt) : null,
          servedAt: item.servedAt ? new Date(item.servedAt) : null,
          cancelledAt: item.cancelledAt ? new Date(item.cancelledAt) : null,
          createdAt: new Date(item.createdAt),
        },
        update: {
          qty: item.qty,
          note: item.note,
          status: item.status,
          splitGroup: item.splitGroup ?? 0,
          preparedAt: item.preparedAt ? new Date(item.preparedAt) : null,
          servedAt: item.servedAt ? new Date(item.servedAt) : null,
          cancelledAt: item.cancelledAt ? new Date(item.cancelledAt) : null,
        },
      });
    }

    // ── COGS + stock deduction (only on first sync — guard against retries) ─
    const existingTx = await tx.transaction.findUnique({
      where: { id: transaction.id },
      select: { id: true },
    });

    let cogs: number | null = null;

    if (!existingTx) {
      // First sync: compute COGS and deduct ingredient stock
      const { totalCogs, movements } = await computeOrderCogs(tx, orderItems);
      cogs = totalCogs > 0 ? totalCogs : null;

      if (movements.length > 0) {
        await applyStockMovements(tx, movements, "SALE", transaction.id);
      }
    }

    // ── Upsert transaction ─────────────────────────────────────────────────
    await tx.transaction.upsert({
      where: { id: transaction.id },
      create: {
        id: transaction.id,
        tableSessionId: transaction.tableSessionId,
        processedById: transaction.processedById,
        subtotal: transaction.subtotal,
        taxAmount: transaction.taxAmount,
        serviceCharge: transaction.serviceCharge,
        discountAmount: transaction.discountAmount,
        totalAmount: transaction.totalAmount,
        cashAmount: transaction.cashAmount,
        qrisAmount: transaction.qrisAmount,
        paymentMethod: transaction.paymentMethod,
        splitGroup: transaction.splitGroup ?? 0,
        status: transaction.status,
        paidAt: new Date(transaction.paidAt),
        createdAt: new Date(transaction.createdAt),
        cogs,
      },
      update: {
        status: transaction.status,
        splitGroup: transaction.splitGroup ?? 0,
      },
    });
  });
}

/** Sync a session's mutable fields (name, service, externalOrderId) to the server. Creates if missing. */
export async function pushSessionUpdate(session: TableSession): Promise<void> {
  await prisma.tableSession.upsert({
    where: { id: session.id },
    create: {
      id: session.id,
      name: session.name,
      service: session.service ?? undefined,
      externalOrderId: session.externalOrderId ?? null,
      customerAlias: session.customerAlias,
      customerPhone: session.customerPhone,
      ownerId: session.ownerId ?? undefined,
      orderedAt: session.orderedAt ? new Date(session.orderedAt) : null,
      servedAt: session.servedAt ? new Date(session.servedAt) : null,
      paidAt: session.paidAt ? new Date(session.paidAt) : null,
      erasedAt: session.erasedAt ? new Date(session.erasedAt) : null,
      createdAt: new Date(session.createdAt),
    },
    update: { name: session.name, service: session.service ?? null, externalOrderId: session.externalOrderId ?? null },
  });
}

/** Sync an erased (cancelled) session to the server — no transaction needed. */
export async function pushErasedSession(session: TableSession): Promise<void> {
  const existing = await prisma.tableSession.findUnique({
    where: { id: session.id },
    select: { erasedAt: true },
  });

  await prisma.tableSession.upsert({
    where: { id: session.id },
    create: {
      id: session.id,
      name: session.name,
      service: session.service ?? undefined,
      externalOrderId: session.externalOrderId ?? null,
      customerAlias: session.customerAlias,
      customerPhone: session.customerPhone,
      ownerId: session.ownerId ?? undefined,
      orderedAt: session.orderedAt ? new Date(session.orderedAt) : null,
      servedAt: session.servedAt ? new Date(session.servedAt) : null,
      paidAt: null,
      erasedAt: session.erasedAt ? new Date(session.erasedAt) : null,
      createdAt: new Date(session.createdAt),
    },
    update: {
      erasedAt: session.erasedAt ? new Date(session.erasedAt) : null,
    },
  });

  // Notify owners only on the transition from not-erased to erased.
  if (session.erasedAt && !existing?.erasedAt) {
    const actor = session.ownerId
      ? await prisma.staff.findUnique({
          where: { id: session.ownerId },
          select: { id: true, name: true },
        })
      : null;
    await createVoidNotification({
      type: "SESSION_VOIDED",
      actorName: actor?.name ?? "Kasir",
      actorId: actor?.id ?? null,
      subjectLabel: `Sesi "${session.name}"`,
      reason: null,
      metadata: { sessionId: session.id },
    });
  }
}
