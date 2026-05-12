"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { TableSession, OrderItem, Transaction } from "@/lib/db";
import { pushTransaction, pushErasedSession, pushSessionUpdate } from "@/app/actions/push-transaction";
import { activeItems as getActiveItems, calcItemPrice } from "@/lib/kasir-utils";
import type { ServiceEnum } from "@/lib/db";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nowISO() {
  return new Date().toISOString();
}

function newId() {
  return crypto.randomUUID();
}

// ─── Reactive queries ─────────────────────────────────────────────────────────

/** All open (unpaid, not erased) sessions. */
export function useOpenSessions() {
  return useLiveQuery(
    () => db.table_sessions.filter((s) => s.paidAt === null && !s.erasedAt).toArray(),
    []
  );
}

/** All closed sessions (paid or erased), newest first. */
export function usePaidSessions() {
  return useLiveQuery(
    () =>
      db.table_sessions
        .filter((s) => s.paidAt !== null || !!s.erasedAt)
        .toArray()
        .then((arr) => arr.sort((a, b) => {
          const aTime = a.paidAt ?? a.erasedAt ?? a.createdAt;
          const bTime = b.paidAt ?? b.erasedAt ?? b.createdAt;
          return bTime.localeCompare(aTime);
        })),
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

/** Transaction for a given session (first one — use useTransactions for split bills). */
export function useTransaction(tableSessionId: string | null) {
  return useLiveQuery(
    () =>
      tableSessionId
        ? db.transactions.where("tableSessionId").equals(tableSessionId).first()
        : undefined,
    [tableSessionId]
  );
}

/** All transactions for a given session. */
export function useTransactions(tableSessionId: string | null): Transaction[] | undefined {
  return useLiveQuery(
    () =>
      tableSessionId
        ? db.transactions.where("tableSessionId").equals(tableSessionId).toArray()
        : ([] as Transaction[]),
    [tableSessionId]
  );
}

/** Transaction for a specific split group within a session. */
export function useTransactionForGroup(tableSessionId: string | null, splitGroup: number) {
  const txs = useTransactions(tableSessionId);
  return txs?.find((t) => t.splitGroup === splitGroup);
}

/** Aggregates multiple transactions into a single virtual transaction object for unified receipt. */
export function aggregateTransactions(txs: Transaction[]) {
  if (txs.length === 0) return undefined;
  if (txs.length === 1) return txs[0];
  return {
    subtotal: txs.reduce((s, t) => s + t.subtotal, 0),
    taxAmount: txs.reduce((s, t) => s + t.taxAmount, 0),
    serviceCharge: txs.reduce((s, t) => s + t.serviceCharge, 0),
    discountAmount: txs.reduce((s, t) => s + t.discountAmount, 0),
    totalAmount: txs.reduce((s, t) => s + t.totalAmount, 0),
    cashAmount: txs.reduce((s, t) => s + t.cashAmount, 0),
    qrisAmount: txs.reduce((s, t) => s + t.qrisAmount, 0),
    paymentMethod: "SPLIT" as const,
    paidAt: txs[txs.length - 1].paidAt,
    cashierName: txs[0].cashierName,
    status: txs.every((t) => t.status === "PAID") ? ("PAID" as const) : ("VOIDED" as const),
    splitGroup: 0,
  };
}

/** Computes split payment status for a session. */
export function useSessionSplitStatus(sessionId: string) {
  const items = useOrderItems(sessionId);
  const txs = useTransactions(sessionId);

  const activeItems = getActiveItems(items ?? []);
  const unassigned = activeItems.filter((i) => i.splitGroup === 0);
  const paidGroups = new Set((txs ?? []).map((t) => t.splitGroup).filter((g) => g > 0));
  const assignedGroups = new Set(activeItems.map((i) => i.splitGroup).filter((g) => g > 0));
  const unpaidGroups = [...assignedGroups].filter((g) => !paidGroups.has(g));

  return {
    activeItems,
    unassigned,
    paidGroups,
    assignedGroups,
    unpaidGroups,
    allAssigned: unassigned.length === 0 && activeItems.length > 0,
    allPaid: unassigned.length === 0 && unpaidGroups.length === 0 && activeItems.length > 0,
  };
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
  data: Pick<TableSession, "name" | "service" | "externalOrderId" | "customerAlias" | "customerPhone" | "ownerId">
): Promise<string> {
  const id = newId();
  await db.table_sessions.add({
    id,
    name: data.name,
    service: data.service,
    externalOrderId: data.externalOrderId,
    customerAlias: data.customerAlias,
    customerPhone: data.customerPhone,
    ownerId: data.ownerId,
    orderedAt: null,
    servedAt: null,
    paidAt: null,
    erasedAt: null,
    createdAt: nowISO(),
    synced: 0,
  });
  return id;
}

/** Rename a still-open (unpaid) session. No-op + throws if session is paid. */
export async function renameSession(sessionId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Nama meja tidak boleh kosong");

  const existing = await db.table_sessions.get(sessionId);
  if (!existing) throw new Error("Sesi tidak ditemukan");
  if (existing.paidAt) throw new Error("Sesi sudah dibayar, tidak bisa diubah");

  await db.table_sessions.update(sessionId, { name: trimmed, synced: 0 });

  const updated = await db.table_sessions.get(sessionId);
  if (updated) {
    pushSessionUpdate(updated)
      .then(() => db.table_sessions.update(sessionId, { synced: 1 }))
      .catch((err) => console.error("[renameSession] sync failed", err));
  }
}

/** Update the external order ID (vendor order ID) for an open session. */
export async function updateExternalOrderId(sessionId: string, externalOrderId: string): Promise<void> {
  const trimmed = externalOrderId.trim();
  if (!trimmed) throw new Error("ID pesanan tidak boleh kosong");

  const existing = await db.table_sessions.get(sessionId);
  if (!existing) throw new Error("Sesi tidak ditemukan");
  if (existing.paidAt) throw new Error("Sesi sudah dibayar, tidak bisa diubah");

  await db.table_sessions.update(sessionId, { externalOrderId: trimmed, synced: 0 });

  const updated = await db.table_sessions.get(sessionId);
  if (updated) {
    pushSessionUpdate(updated)
      .then(() => db.table_sessions.update(sessionId, { synced: 1 }))
      .catch((err) => console.error("[updateExternalOrderId] sync failed", err));
  }
}

/** Erase (cancel) a session without payment. */
export async function eraseSession(sessionId: string): Promise<void> {
  const erasedAt = nowISO();
  await db.table_sessions.update(sessionId, { erasedAt, synced: 0 });

  // Fire-and-forget sync to server
  const session = await db.table_sessions.get(sessionId);
  if (session) {
    pushErasedSession(session)
      .then(() => db.table_sessions.update(sessionId, { synced: 1 }))
      .catch((err) => console.error("[eraseSession] sync failed", err));
  }
}

/**
 * Update the service type of an open session and auto-recalculate item prices.
 * Returns the number of items whose prices changed.
 */
export async function updateSessionService(
  sessionId: string,
  service: ServiceEnum | null,
): Promise<number> {
  const existing = await db.table_sessions.get(sessionId);
  if (!existing) throw new Error("Sesi tidak ditemukan");
  if (existing.paidAt) throw new Error("Sesi sudah dibayar, tidak bisa diubah");

  await db.table_sessions.update(sessionId, { service, synced: 0 });

  // Recalculate prices for all non-cancelled items in this session
  let updatedCount = 0;
  const items = await db.order_items.where("tableSessionId").equals(sessionId).toArray();
  if (items.length > 0) {
    const [onlinePrices, menuItems, menuVariants] = await Promise.all([
      db.online_prices.toArray(),
      db.menu_items.toArray(),
      db.menu_variants.toArray(),
    ]);
    for (const item of items) {
      if (item.status === "CANCELLED" || !item.menuItemId) continue;
      const menuItem = menuItems.find((m) => m.id === item.menuItemId);
      if (!menuItem) continue;
      const variant = item.variantId ? menuVariants.find((v) => v.id === item.variantId) ?? null : null;
      const newPrice = calcItemPrice(menuItem, variant, service, onlinePrices);
      if (newPrice !== item.price) {
        await db.order_items.update(item.id, { price: newPrice });
        updatedCount++;
      }
    }
  }

  // Fire-and-forget sync
  const updated = await db.table_sessions.get(sessionId);
  if (updated) {
    pushSessionUpdate(updated)
      .then(() => db.table_sessions.update(sessionId, { synced: 1 }))
      .catch((err) => console.error("[updateSessionService] sync failed", err));
  }

  return updatedCount;
}

// ─── Order item actions ───────────────────────────────────────────────────────

export async function addOrderItem(
  item: Omit<OrderItem, "id" | "createdAt" | "status" | "preparedAt" | "servedAt" | "cancelledAt" | "splitGroup"> & { splitGroup?: number }
): Promise<string> {
  const id = newId();
  await db.order_items.add({
    ...item,
    id,
    splitGroup: item.splitGroup ?? 0,
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

export async function assignSplitGroup(itemId: string, group: number): Promise<void> {
  await db.order_items.update(itemId, { splitGroup: group });
}

// ─── Payment & sync ───────────────────────────────────────────────────────────

export interface PaymentInput {
  tableSessionId: string;
  processedById: string;
  cashierName: string;
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  discountAmount: number;
  totalAmount: number;
  cashAmount: number;
  qrisAmount: number;
  paymentMethod: Transaction["paymentMethod"];
  /** Which split group this payment covers (0 = non-split). */
  splitGroup?: number;
  /** If true, does not mark the session as paidAt (used for intermediate split group payments). */
  skipSessionPaidMark?: boolean;
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
    cashierName: input.cashierName,
    subtotal: input.subtotal,
    taxAmount: input.taxAmount,
    serviceCharge: input.serviceCharge,
    discountAmount: input.discountAmount,
    totalAmount: input.totalAmount,
    cashAmount: input.cashAmount,
    qrisAmount: input.qrisAmount,
    paymentMethod: input.paymentMethod,
    splitGroup: input.splitGroup ?? 0,
    status: "PAID",
    paidAt,
    createdAt: nowISO(),
    synced: 0,
  };

  await db.transaction("rw", [db.transactions, db.table_sessions], async () => {
    await db.transactions.add(transaction);
    if (!input.skipSessionPaidMark) {
      await db.table_sessions.update(input.tableSessionId, {
        paidAt,
        synced: 0,
      });
    }
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

/**
 * After a "pay first" single-group payment, checks if all items are assigned
 * and all assigned groups are paid — if so, marks the session as paid.
 */
export async function checkAndFinalizeSession(sessionId: string): Promise<boolean> {
  const allItems = await db.order_items.where("tableSessionId").equals(sessionId).toArray();
  const activeItems = getActiveItems(allItems);
  const unassigned = activeItems.filter((i) => i.splitGroup === 0);
  if (unassigned.length > 0 || activeItems.length === 0) return false;

  const allTxs = await db.transactions.where("tableSessionId").equals(sessionId).toArray();
  const paidGroups = new Set(allTxs.map((t) => t.splitGroup).filter((g) => g > 0));
  const assignedGroups = new Set(activeItems.map((i) => i.splitGroup).filter((g) => g > 0));
  const allGroupsPaid = [...assignedGroups].every((g) => paidGroups.has(g));

  if (allGroupsPaid) {
    await db.table_sessions.update(sessionId, { paidAt: nowISO(), synced: 0 });
    return true;
  }
  return false;
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

  // Also retry erased sessions that haven't synced
  const unsyncedErased = await db.table_sessions
    .filter((s) => !!s.erasedAt && s.synced === 0)
    .toArray();

  for (const session of unsyncedErased) {
    pushErasedSession(session)
      .then(() => db.table_sessions.update(session.id, { synced: 1 }))
      .catch((err) => {
        console.error(`[retryUnsyncedTransactions] erased session ${session.id} failed`, err);
      });
  }
}
