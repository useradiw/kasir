"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { TableSession, OrderItem, Transaction } from "@/lib/db";
import { pushTransaction } from "@/app/actions/push-transaction";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nowISO() {
  return new Date().toISOString();
}

function newId() {
  return crypto.randomUUID();
}

// ─── Reactive queries ─────────────────────────────────────────────────────────

/** All open (unpaid) sessions. */
export function useOpenSessions() {
  return useLiveQuery(
    () => db.table_sessions.filter((s) => s.paidAt === null).toArray(),
    []
  );
}

/** All paid (closed) sessions, newest first. */
export function usePaidSessions() {
  return useLiveQuery(
    () =>
      db.table_sessions
        .filter((s) => s.paidAt !== null)
        .reverse()
        .sortBy("paidAt"),
    []
  );
}

/** All order items for a given session. */
export function useOrderItems(tableSessionId: string) {
  return useLiveQuery(
    () => db.order_items.where("tableSessionId").equals(tableSessionId).toArray(),
    [tableSessionId]
  );
}

/** Transaction for a given session. */
export function useTransaction(tableSessionId: string | null) {
  return useLiveQuery(
    () =>
      tableSessionId
        ? db.transactions.where("tableSessionId").equals(tableSessionId).first()
        : undefined,
    [tableSessionId]
  );
}

/** Count of unsynced transactions. */
export function useUnsyncedCount() {
  return useLiveQuery(
    () => db.transactions.where("synced").equals(0).count(),
    []
  );
}

// ─── Session actions ──────────────────────────────────────────────────────────

export async function createSession(
  data: Pick<TableSession, "name" | "service" | "customerAlias" | "ownerId">
): Promise<string> {
  const id = newId();
  await db.table_sessions.add({
    id,
    name: data.name,
    service: data.service,
    customerAlias: data.customerAlias,
    ownerId: data.ownerId,
    orderedAt: null,
    servedAt: null,
    paidAt: null,
    createdAt: nowISO(),
    synced: 0,
  });
  return id;
}

// ─── Order item actions ───────────────────────────────────────────────────────

export async function addOrderItem(
  item: Omit<OrderItem, "id" | "createdAt" | "status" | "preparedAt" | "servedAt" | "cancelledAt">
): Promise<string> {
  const id = newId();
  await db.order_items.add({
    ...item,
    id,
    status: "PENDING",
    preparedAt: null,
    servedAt: null,
    cancelledAt: null,
    createdAt: nowISO(),
  });

  // Mark session as ordered
  await db.table_sessions.update(item.tableSessionId, {
    orderedAt: nowISO(),
  });

  return id;
}

export async function updateOrderItemStatus(
  id: string,
  status: OrderItem["status"]
): Promise<void> {
  const updates: Partial<OrderItem> = { status };
  const now = nowISO();
  if (status === "PREPARING") updates.preparedAt = now;
  if (status === "SERVED") updates.servedAt = now;
  if (status === "CANCELLED") updates.cancelledAt = now;
  await db.order_items.update(id, updates);
}

export async function removeOrderItem(id: string): Promise<void> {
  await db.order_items.delete(id);
}

export async function updateOrderItemQty(id: string, qty: number): Promise<void> {
  await db.order_items.update(id, { qty });
}

// ─── Payment & sync ───────────────────────────────────────────────────────────

export interface PaymentInput {
  tableSessionId: string;
  processedById: string;
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  discountAmount: number;
  totalAmount: number;
  cashAmount: number;
  qrisAmount: number;
  paymentMethod: Transaction["paymentMethod"];
}

/**
 * Records payment locally, marks session as paid, then fires-and-forgets a
 * server sync. Returns the new transaction id.
 */
export async function recordPayment(input: PaymentInput): Promise<string> {
  const txId = newId();
  const paidAt = nowISO();

  const transaction: Transaction = {
    id: txId,
    tableSessionId: input.tableSessionId,
    processedById: input.processedById,
    subtotal: input.subtotal,
    taxAmount: input.taxAmount,
    serviceCharge: input.serviceCharge,
    discountAmount: input.discountAmount,
    totalAmount: input.totalAmount,
    cashAmount: input.cashAmount,
    qrisAmount: input.qrisAmount,
    paymentMethod: input.paymentMethod,
    status: "PAID",
    paidAt,
    createdAt: nowISO(),
    synced: 0,
  };

  await db.transaction("rw", [db.transactions, db.table_sessions], async () => {
    await db.transactions.add(transaction);
    await db.table_sessions.update(input.tableSessionId, {
      paidAt,
      synced: 0,
    });
  });

  // Fire-and-forget server sync
  const session = await db.table_sessions.get(input.tableSessionId);
  const orderItems = await db.order_items
    .where("tableSessionId")
    .equals(input.tableSessionId)
    .toArray();

  if (session) {
    pushTransaction({ session, orderItems, transaction })
      .then(async () => {
        await db.transaction(
          "rw",
          [db.transactions, db.table_sessions],
          async () => {
            await db.transactions.update(txId, { synced: 1 });
            await db.table_sessions.update(input.tableSessionId, { synced: 1 });
          }
        );
      })
      .catch((err) => {
        console.error("[recordPayment] sync failed — will retry next session", err);
      });
  }

  return txId;
}

// ─── Retry unsynced transactions on app start ─────────────────────────────────

/**
 * Call once on app mount (e.g. in a layout) to push any transactions
 * that failed to sync in a previous session.
 */
export async function retryUnsyncedTransactions(): Promise<void> {
  const unsyncedTx = await db.transactions.where("synced").equals(0).toArray();

  for (const tx of unsyncedTx) {
    const session = await db.table_sessions.get(tx.tableSessionId);
    const orderItems = await db.order_items
      .where("tableSessionId")
      .equals(tx.tableSessionId)
      .toArray();

    if (!session) continue;

    pushTransaction({ session, orderItems, transaction: tx })
      .then(async () => {
        await db.transaction(
          "rw",
          [db.transactions, db.table_sessions],
          async () => {
            await db.transactions.update(tx.id, { synced: 1 });
            await db.table_sessions.update(tx.tableSessionId, { synced: 1 });
          }
        );
      })
      .catch((err) => {
        console.error(`[retryUnsyncedTransactions] tx ${tx.id} failed`, err);
      });
  }
}
