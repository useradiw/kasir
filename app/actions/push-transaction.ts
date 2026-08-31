"use server";

import { prisma } from "@/lib/prisma";
import type { TableSession, OrderItem, Transaction } from "@/lib/db";
import { createVoidNotification } from "@/lib/notifications";
import { parsePushPayload, sessionSchema, type PushOrigin } from "@/lib/kasir-payload";
import { requireAuth } from "@/lib/admin-auth";

export interface TransactionPayload {
  session: TableSession;
  orderItems: OrderItem[];
  transaction: Transaction;
  /** "payment" = pushed as the sale happens; "retry" = re-pushed later. */
  origin?: PushOrigin;
}

export async function pushTransaction(payload: TransactionPayload): Promise<void> {
  await requireAuth();

  // Shape + money validation lives in lib/kasir-payload.ts so it is testable
  // (test/money-parity.test.ts proves it accepts everything the client emits).
  const { session, orderItems, transaction, subtotalDrift } = parsePushPayload(payload);

  if (subtotalDrift) {
    // A retried sale whose items were edited after it was paid. The money was
    // already collected, so the sale is recorded; this line is the only way
    // anyone learns the item list no longer explains it.
    console.warn(
      `[pushTransaction] tx ${transaction.id} synced with drifted items: ${subtotalDrift}`,
    );
  }

  // Identity is deliberately NOT enforced here. A sale made offline is often
  // synced later — after a shift change, by whoever is signed in on the shared
  // device — so requiring transaction.processedById === staff.id would strand
  // that sale forever (the sync path only retries and logs). Authentication is
  // the gate; the FK on Transaction.processedById proves the named cashier is
  // real.

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

    // ── Upsert transaction ─────────────────────────────────────────────────
    const cogs: number | null = null;
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
  await requireAuth();
  const parsed = sessionSchema.parse(session);

  await prisma.tableSession.upsert({
    where: { id: parsed.id },
    create: {
      id: parsed.id,
      name: parsed.name,
      service: parsed.service ?? undefined,
      externalOrderId: parsed.externalOrderId ?? null,
      customerAlias: parsed.customerAlias,
      customerPhone: parsed.customerPhone,
      ownerId: parsed.ownerId ?? undefined,
      orderedAt: parsed.orderedAt ? new Date(parsed.orderedAt) : null,
      servedAt: parsed.servedAt ? new Date(parsed.servedAt) : null,
      paidAt: parsed.paidAt ? new Date(parsed.paidAt) : null,
      erasedAt: parsed.erasedAt ? new Date(parsed.erasedAt) : null,
      createdAt: new Date(parsed.createdAt),
    },
    update: {
      name: parsed.name,
      service: parsed.service ?? null,
      externalOrderId: parsed.externalOrderId ?? null,
    },
  });
}

/** Sync an erased (cancelled) session to the server — no transaction needed. */
export async function pushErasedSession(session: TableSession): Promise<void> {
  await requireAuth();
  const parsed = sessionSchema.parse(session);

  const existing = await prisma.tableSession.findUnique({
    where: { id: parsed.id },
    select: { erasedAt: true },
  });

  await prisma.tableSession.upsert({
    where: { id: parsed.id },
    create: {
      id: parsed.id,
      name: parsed.name,
      service: parsed.service ?? undefined,
      externalOrderId: parsed.externalOrderId ?? null,
      customerAlias: parsed.customerAlias,
      customerPhone: parsed.customerPhone,
      ownerId: parsed.ownerId ?? undefined,
      orderedAt: parsed.orderedAt ? new Date(parsed.orderedAt) : null,
      servedAt: parsed.servedAt ? new Date(parsed.servedAt) : null,
      paidAt: null,
      erasedAt: parsed.erasedAt ? new Date(parsed.erasedAt) : null,
      createdAt: new Date(parsed.createdAt),
    },
    update: {
      erasedAt: parsed.erasedAt ? new Date(parsed.erasedAt) : null,
    },
  });

  // Notify owners only on the transition from not-erased to erased.
  if (parsed.erasedAt && !existing?.erasedAt) {
    const actor = parsed.ownerId
      ? await prisma.staff.findUnique({
          where: { id: parsed.ownerId },
          select: { id: true, name: true },
        })
      : null;
    await createVoidNotification({
      type: "SESSION_VOIDED",
      actorName: actor?.name ?? "Kasir",
      actorId: actor?.id ?? null,
      subjectLabel: `Sesi "${parsed.name}"`,
      reason: null,
      metadata: { sessionId: parsed.id },
    });
  }
}
