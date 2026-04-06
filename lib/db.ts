import Dexie, { type EntityTable, type Table } from "dexie";

// ─── Product schema (synced from server, read-only locally) ───────────────────

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MenuItem {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MenuVariant {
  id: string;
  menuItemId: string;
  label: string;
  priceModifier: number;
}

export interface Package {
  id: string;
  name: string;
  bundlePrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface PackageItem {
  id: string;
  packageId: string;
  menuItemId: string;
  variantId: string | null;
  nameSnapshot: string;
}

// ─── Transaction schema (local-first, synced to server on payment) ────────────

export type ServiceEnum =
  | "GoFood"
  | "ShopeeFood"
  | "GrabFood"
  | "Take_Away"
  | "Unknown";

export type OrderItemStatus = "PENDING" | "PREPARING" | "SERVED" | "CANCELLED";

export type PaymentMethod = "CASH" | "QRIS";

export type TransactionStatus = "PAID" | "VOIDED";

export interface TableSession {
  id: string;
  name: string;
  service: ServiceEnum | null;
  customerAlias: string | null;
  customerPhone: string | null;
  ownerId: string | null;
  orderedAt: string | null;
  servedAt: string | null;
  paidAt: string | null;
  erasedAt: string | null;
  createdAt: string;
  synced: 0 | 1; // 0 = not synced, 1 = synced (IndexedDB only indexes numbers cleanly)
}

export interface OrderItem {
  id: string;
  tableSessionId: string;
  menuItemId: string | null;
  packageId: string | null;
  variantId: string | null;
  qty: number;
  note: string | null;
  status: OrderItemStatus;
  nameSnapshot: string;
  price: number;
  preparedAt: string | null;
  servedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface Transaction {
  id: string;
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
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  paidAt: string;
  createdAt: string;
  synced: 0 | 1;
}

// ─── Dexie database ───────────────────────────────────────────────────────────

export class KasirDB extends Dexie {
  categories!: EntityTable<Category, "id">;
  menu_items!: EntityTable<MenuItem, "id">;
  menu_variants!: EntityTable<MenuVariant, "id">;
  packages!: EntityTable<Package, "id">;
  package_items!: EntityTable<PackageItem, "id">;
  table_sessions!: EntityTable<TableSession, "id">;
  order_items!: EntityTable<OrderItem, "id">;
  transactions!: EntityTable<Transaction, "id">;

  constructor() {
    super("kasir-db");
    this.version(1).stores({
      categories: "id, sortOrder",
      menu_items: "id, categoryId",
      menu_variants: "id, menuItemId",
      packages: "id",
      package_items: "[packageId+menuItemId], packageId",
      table_sessions: "id, paidAt, synced",
      order_items: "id, tableSessionId",
      transactions: "id, tableSessionId, synced",
    });
    this.version(2).stores({
      package_items: "id, packageId",
    });
    this.version(3).stores({
      table_sessions: "id, paidAt, synced",
    }).upgrade(tx => {
      return tx.table('table_sessions').toCollection().modify(session => {
        if (session.customerPhone === undefined) session.customerPhone = null;
        if (session.erasedAt === undefined) session.erasedAt = null;
      });
    });
  }
}

export const db = new KasirDB();
