"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";

export async function getTransactionsData(opts: {
  page: number;
  method: string;
  status: string;
  from: string;
  to: string;
}) {
  await requireRole("OWNER", "MANAGER");

  const PAGE_SIZE = 20;
  const where: {
    paymentMethod?: "CASH" | "QRIS" | "SPLIT" | "PENDING";
    status?: "PAID" | "VOIDED";
    paidAt?: { gte?: Date; lt?: Date };
  } = {};

  if (opts.method) where.paymentMethod = opts.method as "CASH" | "QRIS" | "SPLIT" | "PENDING";
  if (opts.status) where.status = opts.status as "PAID" | "VOIDED";
  if (opts.from || opts.to) {
    where.paidAt = {};
    if (opts.from) where.paidAt.gte = new Date(opts.from);
    if (opts.to) {
      const toDate = new Date(opts.to);
      toDate.setDate(toDate.getDate() + 1);
      where.paidAt.lt = toDate;
    }
  }

  const [total, transactions] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { paidAt: "desc" },
      skip: (opts.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        processedBy: { select: { name: true } },
        voidedBy: { select: { name: true } },
        settlementItem: { select: { id: true } },
        tableSession: {
          select: {
            name: true,
            service: true,
            externalOrderId: true,
            orderItems: {
              select: { nameSnapshot: true, qty: true, price: true, status: true },
            },
          },
        },
      },
    }),
  ]);

  return {
    total,
    totalPages: Math.ceil(total / PAGE_SIZE),
    rows: transactions.map((t) => ({
      id: t.id,
      sessionName: t.tableSession.name,
      service: t.tableSession.service as string | null,
      externalOrderId: t.tableSession.externalOrderId ?? null,
      isSettled: !!t.settlementItem,
      totalAmount: t.totalAmount,
      subtotal: t.subtotal,
      taxAmount: t.taxAmount,
      serviceCharge: t.serviceCharge,
      cashAmount: t.cashAmount,
      qrisAmount: t.qrisAmount,
      paymentMethod: t.paymentMethod as string,
      status: t.status as string,
      paidAt: t.paidAt.toISOString(),
      processedBy: t.processedBy?.name ?? null,
      voidedBy: t.voidedBy?.name ?? null,
      voidedAt: t.voidedAt?.toISOString() ?? null,
      voidReason: t.voidReason ?? null,
      orderItems: t.tableSession.orderItems.map((oi) => ({
        nameSnapshot: oi.nameSnapshot,
        qty: oi.qty,
        price: oi.price,
        status: oi.status as string,
      })),
    })),
  };
}

export async function getTransactionDetail(transactionId: string) {
  await requireRole("OWNER", "MANAGER");

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      processedBy: { select: { name: true } },
      voidedBy: { select: { name: true } },
      tableSession: {
        include: {
          orderItems: {
            orderBy: { createdAt: "asc" },
          },
          owner: { select: { name: true } },
        },
      },
    },
  });

  if (!tx) return null;

  return {
    id: tx.id,
    subtotal: tx.subtotal,
    taxAmount: tx.taxAmount,
    serviceCharge: tx.serviceCharge,
    discountAmount: tx.discountAmount,
    totalAmount: tx.totalAmount,
    cashAmount: tx.cashAmount,
    qrisAmount: tx.qrisAmount,
    paymentMethod: tx.paymentMethod as string,
    status: tx.status as string,
    paidAt: tx.paidAt.toISOString(),
    createdAt: tx.createdAt.toISOString(),
    processedBy: tx.processedBy?.name ?? null,
    voidedBy: tx.voidedBy?.name ?? null,
    voidedAt: tx.voidedAt?.toISOString() ?? null,
    voidReason: tx.voidReason ?? null,
    session: {
      id: tx.tableSession.id,
      name: tx.tableSession.name,
      service: tx.tableSession.service as string | null,
      externalOrderId: tx.tableSession.externalOrderId ?? null,
      customerAlias: tx.tableSession.customerAlias,
      customerPhone: tx.tableSession.customerPhone,
      ownerName: tx.tableSession.owner?.name ?? null,
    },
    orderItems: tx.tableSession.orderItems.map((oi) => ({
      id: oi.id,
      nameSnapshot: oi.nameSnapshot,
      qty: oi.qty,
      price: oi.price,
      note: oi.note,
      status: oi.status as string,
    })),
  };
}

export type TransactionDetail = NonNullable<Awaited<ReturnType<typeof getTransactionDetail>>>;
