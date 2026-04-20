"use server";

import { prisma } from "@/lib/prisma";
import type { TableSession, OrderItem, Transaction } from "@/lib/db";

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

  await prisma.$transaction([
    // Upsert table session
    prisma.tableSession.upsert({
      where: { id: session.id },
      create: {
        id: session.id,
        name: session.name,
        service: session.service ?? undefined,
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
        paidAt: session.paidAt ? new Date(session.paidAt) : null,
        servedAt: session.servedAt ? new Date(session.servedAt) : null,
        erasedAt: session.erasedAt ? new Date(session.erasedAt) : null,
      },
    }),

    // Upsert order items
    ...orderItems.map((item) =>
      prisma.orderItem.upsert({
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
          preparedAt: item.preparedAt ? new Date(item.preparedAt) : null,
          servedAt: item.servedAt ? new Date(item.servedAt) : null,
          cancelledAt: item.cancelledAt ? new Date(item.cancelledAt) : null,
          createdAt: new Date(item.createdAt),
        },
        update: {
          qty: item.qty,
          note: item.note,
          status: item.status,
          preparedAt: item.preparedAt ? new Date(item.preparedAt) : null,
          servedAt: item.servedAt ? new Date(item.servedAt) : null,
          cancelledAt: item.cancelledAt ? new Date(item.cancelledAt) : null,
        },
      })
    ),

    // Upsert transaction
    prisma.transaction.upsert({
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
        status: transaction.status,
        paidAt: new Date(transaction.paidAt),
        createdAt: new Date(transaction.createdAt),
      },
      update: {
        status: transaction.status,
      },
    }),
  ]);
}

/** Sync a renamed (still-open) session to the server. Creates if missing, updates name otherwise. */
export async function pushRenamedSession(session: TableSession): Promise<void> {
  await prisma.tableSession.upsert({
    where: { id: session.id },
    create: {
      id: session.id,
      name: session.name,
      service: session.service ?? undefined,
      customerAlias: session.customerAlias,
      customerPhone: session.customerPhone,
      ownerId: session.ownerId ?? undefined,
      orderedAt: session.orderedAt ? new Date(session.orderedAt) : null,
      servedAt: session.servedAt ? new Date(session.servedAt) : null,
      paidAt: session.paidAt ? new Date(session.paidAt) : null,
      erasedAt: session.erasedAt ? new Date(session.erasedAt) : null,
      createdAt: new Date(session.createdAt),
    },
    update: { name: session.name },
  });
}

/** Sync an erased (cancelled) session to the server — no transaction needed. */
export async function pushErasedSession(session: TableSession): Promise<void> {
  await prisma.tableSession.upsert({
    where: { id: session.id },
    create: {
      id: session.id,
      name: session.name,
      service: session.service ?? undefined,
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
}
