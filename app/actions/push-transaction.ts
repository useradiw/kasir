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

  await prisma.$transaction([
    // Upsert table session
    prisma.tableSession.upsert({
      where: { id: session.id },
      create: {
        id: session.id,
        name: session.name,
        service: session.service ?? undefined,
        customerAlias: session.customerAlias,
        ownerId: session.ownerId,
        orderedAt: session.orderedAt ? new Date(session.orderedAt) : null,
        servedAt: session.servedAt ? new Date(session.servedAt) : null,
        paidAt: session.paidAt ? new Date(session.paidAt) : null,
        createdAt: new Date(session.createdAt),
      },
      update: {
        paidAt: session.paidAt ? new Date(session.paidAt) : null,
        servedAt: session.servedAt ? new Date(session.servedAt) : null,
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
          createdAt: new Date(item.createdAt),
        },
        update: {
          qty: item.qty,
          note: item.note,
          status: item.status,
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
