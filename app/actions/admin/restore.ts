"use server";

import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";

export interface BackupData {
  version?: number;
  exportedAt?: string;
  tables: Record<string, unknown[]>;
}

// FK-safe import order
const IMPORT_ORDER = [
  "settings",
  "staff",
  "categories",
  "expenseTemplates",
  "menuItems",
  "packages",
  "menuVariants",
  "packageItems",
  "menuItemOnlinePrices",
  "recipes",
  "recipeIngredients",
  "tableSessions",
  "orderItems",
  "transactions",
  "onlineSettlements",
  "settlementItems",
  "settlementDeductions",
  "cashRegisters",
  "expenses",
  "expenseItems",
  "kasPakHar",
  "attendanceRecords",
  "notifications",
  "ingredientLogs",
] as const;

export async function restoreDatabase(
  data: BackupData,
  selectedTables: string[],
): Promise<{ imported: Record<string, number>; errors: string[] }> {
  await requireOwner();

  const imported: Record<string, number> = {};
  const errors: string[] = [];

  const orderedTables = IMPORT_ORDER.filter(
    (t) => selectedTables.includes(t) && Array.isArray(data.tables[t])
  );

  for (const table of orderedTables) {
    const rows = data.tables[table] as Record<string, unknown>[];
    let count = 0;

    try {
      for (const row of rows) {
        if (!row.id && table !== "settings") continue;
        try {
          await upsertRow(table, row);
          count++;
        } catch (err) {
          errors.push(`${table}[${row.id ?? row.key}]: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      imported[table] = count;
    } catch (err) {
      errors.push(`${table}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { imported, errors };
}

function toDate(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? null : d;
}

function toDateRequired(val: unknown): Date {
  const d = toDate(val);
  if (!d) throw new Error(`Invalid date: ${val}`);
  return d;
}

async function upsertRow(table: string, row: Record<string, unknown>): Promise<void> {
  switch (table) {
    case "settings":
      await prisma.setting.upsert({
        where: { key: row.key as string },
        create: { key: row.key as string, value: row.value as string },
        update: { value: row.value as string },
      });
      break;

    case "staff":
      await prisma.staff.upsert({
        where: { id: row.id as string },
        create: {
          id: row.id as string,
          username: row.username as string | null ?? undefined,
          name: row.name as string,
          role: row.role as "OWNER" | "MANAGER" | "CASHIER" | "STAFF",
          isActive: row.isActive as boolean ?? true,
          supabaseUserId: row.supabaseUserId as string | null ?? undefined,
          salary: row.salary as number | null ?? undefined,
          createdAt: toDate(row.createdAt) ?? undefined,
        },
        update: {
          username: row.username as string | null ?? undefined,
          name: row.name as string,
          role: row.role as "OWNER" | "MANAGER" | "CASHIER" | "STAFF",
          isActive: row.isActive as boolean ?? true,
          salary: row.salary as number | null ?? undefined,
        },
      });
      break;

    case "categories":
      await prisma.category.upsert({
        where: { id: row.id as string },
        create: {
          id: row.id as string,
          name: row.name as string,
          sortOrder: row.sortOrder as number ?? 0,
          createdAt: toDate(row.createdAt) ?? undefined,
        },
        update: { name: row.name as string, sortOrder: row.sortOrder as number ?? 0 },
      });
      break;

    case "expenseTemplates":
      await prisma.expenseTemplate.upsert({
        where: { id: row.id as string },
        create: {
          id: row.id as string,
          name: row.name as string,
          defaultUnit: row.defaultUnit as string | null ?? undefined,
          defaultCost: row.defaultCost as number | null ?? undefined,
          isActive: row.isActive as boolean ?? true,
          createdAt: toDate(row.createdAt) ?? undefined,
        },
        update: {
          name: row.name as string,
          defaultUnit: row.defaultUnit as string | null ?? undefined,
          defaultCost: row.defaultCost as number | null ?? undefined,
          isActive: row.isActive as boolean ?? true,
        },
      });
      break;

    case "menuItems":
      await prisma.menuItem.upsert({
        where: { id: row.id as string },
        create: {
          id: row.id as string,
          name: row.name as string,
          categoryId: row.categoryId as string,
          price: row.price as number,
          isHidden: row.isHidden as boolean ?? false,
          createdAt: toDate(row.createdAt) ?? undefined,
        },
        update: {
          name: row.name as string,
          categoryId: row.categoryId as string,
          price: row.price as number,
          isHidden: row.isHidden as boolean ?? false,
        },
      });
      break;

    case "packages":
      await prisma.package.upsert({
        where: { id: row.id as string },
        create: {
          id: row.id as string,
          name: row.name as string,
          bundlePrice: row.bundlePrice as number,
          createdAt: toDate(row.createdAt) ?? undefined,
        },
        update: { name: row.name as string, bundlePrice: row.bundlePrice as number },
      });
      break;

    case "menuVariants":
      await prisma.menuVariant.upsert({
        where: { id: row.id as string },
        create: {
          id: row.id as string,
          menuItemId: row.menuItemId as string,
          label: row.label as string,
          priceModifier: row.priceModifier as number ?? 0,
        },
        update: { label: row.label as string, priceModifier: row.priceModifier as number ?? 0 },
      });
      break;

    case "packageItems":
      await prisma.packageItem.upsert({
        where: { id: row.id as string },
        create: {
          id: row.id as string,
          packageId: row.packageId as string,
          menuItemId: row.menuItemId as string,
          variantId: row.variantId as string | null ?? undefined,
          nameSnapshot: row.nameSnapshot as string,
        },
        update: { nameSnapshot: row.nameSnapshot as string },
      });
      break;

    case "menuItemOnlinePrices":
      await prisma.menuItemOnlinePrice.upsert({
        where: { id: row.id as string },
        create: {
          id: row.id as string,
          menuItemId: row.menuItemId as string,
          variantId: row.variantId as string | null ?? undefined,
          service: row.service as "GoFood" | "ShopeeFood" | "GrabFood",
          price: row.price as number,
        },
        update: { price: row.price as number },
      });
      break;

    case "recipes":
      await prisma.recipe.upsert({
        where: { id: row.id as string },
        create: {
          id: row.id as string,
          menuItemId: row.menuItemId as string,
          variantId: row.variantId as string | null ?? undefined,
          notes: row.notes as string | null ?? undefined,
          createdAt: toDate(row.createdAt) ?? undefined,
        },
        update: { notes: row.notes as string | null ?? undefined },
      });
      break;

    case "recipeIngredients":
      await prisma.recipeIngredient.upsert({
        where: { id: row.id as string },
        create: {
          id: row.id as string,
          recipeId: row.recipeId as string,
          templateId: row.templateId as string | null ?? undefined,
          customName: row.customName as string | null ?? undefined,
          customUnit: row.customUnit as string | null ?? undefined,
          quantity: row.quantity as number,
        },
        update: {
          quantity: row.quantity as number,
          customName: row.customName as string | null ?? undefined,
          customUnit: row.customUnit as string | null ?? undefined,
        },
      });
      break;

    case "tableSessions":
      await prisma.tableSession.upsert({
        where: { id: row.id as string },
        create: {
          id: row.id as string,
          name: row.name as string,
          service: row.service as "GoFood" | "ShopeeFood" | "GrabFood" | "Take_Away" | "Unknown" | null ?? undefined,
          externalOrderId: row.externalOrderId as string | null ?? undefined,
          customerAlias: row.customerAlias as string | null ?? undefined,
          customerPhone: row.customerPhone as string | null ?? undefined,
          ownerId: row.ownerId as string | null ?? undefined,
          orderedAt: toDate(row.orderedAt),
          servedAt: toDate(row.servedAt),
          paidAt: toDate(row.paidAt),
          erasedAt: toDate(row.erasedAt),
          createdAt: toDate(row.createdAt) ?? undefined,
        },
        update: {
          name: row.name as string,
          service: row.service as "GoFood" | "ShopeeFood" | "GrabFood" | "Take_Away" | "Unknown" | null ?? undefined,
          externalOrderId: row.externalOrderId as string | null ?? undefined,
          paidAt: toDate(row.paidAt),
          erasedAt: toDate(row.erasedAt),
        },
      });
      break;

    case "orderItems":
      await prisma.orderItem.upsert({
        where: { id: row.id as string },
        create: {
          id: row.id as string,
          tableSessionId: row.tableSessionId as string,
          menuItemId: row.menuItemId as string | null ?? undefined,
          packageId: row.packageId as string | null ?? undefined,
          variantId: row.variantId as string | null ?? undefined,
          qty: row.qty as number,
          note: row.note as string | null ?? undefined,
          status: row.status as "PENDING" | "PREPARING" | "SERVED" | "CANCELLED" ?? "PENDING",
          nameSnapshot: row.nameSnapshot as string,
          price: row.price as number,
          splitGroup: row.splitGroup as number ?? 0,
          preparedAt: toDate(row.preparedAt),
          servedAt: toDate(row.servedAt),
          cancelledAt: toDate(row.cancelledAt),
          createdAt: toDate(row.createdAt) ?? undefined,
        },
        update: {
          qty: row.qty as number,
          status: row.status as "PENDING" | "PREPARING" | "SERVED" | "CANCELLED" ?? "PENDING",
          price: row.price as number,
          splitGroup: row.splitGroup as number ?? 0,
        },
      });
      break;

    case "transactions":
      await prisma.transaction.upsert({
        where: { id: row.id as string },
        create: {
          id: row.id as string,
          tableSessionId: row.tableSessionId as string,
          processedById: row.processedById as string,
          subtotal: row.subtotal as number,
          taxAmount: row.taxAmount as number ?? 0,
          serviceCharge: row.serviceCharge as number ?? 0,
          discountAmount: row.discountAmount as number ?? 0,
          totalAmount: row.totalAmount as number,
          cashAmount: row.cashAmount as number ?? 0,
          qrisAmount: row.qrisAmount as number ?? 0,
          paymentMethod: row.paymentMethod as "CASH" | "QRIS" | "SPLIT" | "PENDING",
          status: row.status as "PAID" | "VOIDED" ?? "PAID",
          voidedById: row.voidedById as string | null ?? undefined,
          voidedAt: toDate(row.voidedAt),
          voidReason: row.voidReason as string | null ?? undefined,
          paidAt: toDate(row.paidAt) ?? new Date(),
          createdAt: toDate(row.createdAt) ?? undefined,
        },
        update: {
          status: row.status as "PAID" | "VOIDED" ?? "PAID",
          voidedById: row.voidedById as string | null ?? undefined,
          voidedAt: toDate(row.voidedAt),
          voidReason: row.voidReason as string | null ?? undefined,
        },
      });
      break;

    case "onlineSettlements":
      await prisma.onlineSettlement.upsert({
        where: { id: row.id as string },
        create: {
          id: row.id as string,
          service: row.service as "GoFood" | "ShopeeFood" | "GrabFood",
          settlementDate: toDate(row.settlementDate) ?? new Date(),
          totalGross: row.totalGross as number,
          commissionAmount: row.commissionAmount as number,
          finalAmount: row.finalAmount as number,
          settledById: row.settledById as string,
          notes: row.notes as string | null ?? undefined,
          createdAt: toDate(row.createdAt) ?? undefined,
        },
        update: {
          totalGross: row.totalGross as number,
          commissionAmount: row.commissionAmount as number,
          finalAmount: row.finalAmount as number,
          notes: row.notes as string | null ?? undefined,
        },
      });
      break;

    case "settlementItems":
      await prisma.settlementItem.upsert({
        where: { id: row.id as string },
        create: {
          id: row.id as string,
          settlementId: row.settlementId as string,
          transactionId: row.transactionId as string,
        },
        update: {},
      });
      break;

    case "settlementDeductions":
      await prisma.settlementDeduction.upsert({
        where: { id: row.id as string },
        create: {
          id: row.id as string,
          settlementId: row.settlementId as string,
          label: row.label as string,
          amount: row.amount as number,
        },
        update: {
          label: row.label as string,
          amount: row.amount as number,
        },
      });
      break;

    case "ingredientLogs":
      await prisma.ingredientLog.upsert({
        where: { id: row.id as string },
        create: {
          id: row.id as string,
          templateId: row.templateId as string,
          type: row.type as "PURCHASE" | "SALE" | "ADJUSTMENT" | "WASTE",
          quantity: row.quantity as number,
          unitCost: row.unitCost as number,
          referenceId: (row.referenceId as string | null) ?? null,
          note: (row.note as string | null) ?? null,
          createdAt: row.createdAt ? new Date(row.createdAt as string) : new Date(),
        },
        update: {},
      });
      break;

    case "cashRegisters":
      await prisma.cashRegister.upsert({
        where: { id: row.id as string },
        create: {
          id: row.id as string,
          date: toDateRequired(row.date),
          openingCash: row.openingCash as number ?? 0,
          closingCash: row.closingCash as number | null ?? undefined,
          openedById: row.openedById as string | null ?? undefined,
          closedById: row.closedById as string | null ?? undefined,
          editedById: row.editedById as string | null ?? undefined,
          editedAt: toDate(row.editedAt),
          createdAt: toDate(row.createdAt) ?? undefined,
        },
        update: {
          closingCash: row.closingCash as number | null ?? undefined,
          editedById: row.editedById as string | null ?? undefined,
          editedAt: toDate(row.editedAt),
        },
      });
      break;

    case "expenses":
      await prisma.expense.upsert({
        where: { id: row.id as string },
        create: {
          id: row.id as string,
          description: row.description as string | null ?? undefined,
          recordedAt: toDate(row.recordedAt) ?? undefined,
          createdAt: toDate(row.createdAt) ?? undefined,
          staffId: row.staffId as string | null ?? undefined,
          deductFromCash: row.deductFromCash as boolean ?? true,
          countToKasPakHar: row.countToKasPakHar as boolean ?? false,
        },
        update: {
          description: row.description as string | null ?? undefined,
          deductFromCash: row.deductFromCash as boolean ?? true,
          countToKasPakHar: row.countToKasPakHar as boolean ?? false,
        },
      });
      break;

    case "expenseItems":
      await prisma.expenseItem.upsert({
        where: { id: row.id as string },
        create: {
          id: row.id as string,
          expenseId: row.expenseId as string,
          description: row.description as string,
          amount: row.amount as number,
          cost: row.cost as number,
          unit: row.unit as string | null ?? undefined,
          templateId: row.templateId as string | null ?? undefined,
        },
        update: {
          description: row.description as string,
          amount: row.amount as number,
          cost: row.cost as number,
          unit: row.unit as string | null ?? undefined,
        },
      });
      break;

    case "kasPakHar":
      await prisma.kasPakHar.upsert({
        where: { id: row.id as string },
        create: {
          id: row.id as string,
          date: toDate(row.date) ?? undefined,
          type: row.type as "DEPOSIT" | "WITHDRAWAL" | "EXPENSE_DEDUCTION",
          amount: row.amount as number,
          description: row.description as string | null ?? undefined,
          expenseId: row.expenseId as string | null ?? undefined,
          createdById: row.createdById as string | null ?? undefined,
          createdAt: toDate(row.createdAt) ?? undefined,
        },
        update: {
          amount: row.amount as number,
          description: row.description as string | null ?? undefined,
        },
      });
      break;

    case "attendanceRecords":
      await prisma.attendanceRecord.upsert({
        where: { id: row.id as string },
        create: {
          id: row.id as string,
          staffId: row.staffId as string,
          date: toDateRequired(row.date),
          status: row.status as "PRESENT" | "ABSENT",
          markedAt: toDate(row.markedAt) ?? undefined,
        },
        update: { status: row.status as "PRESENT" | "ABSENT" },
      });
      break;

    case "notifications":
      await prisma.notification.upsert({
        where: { id: row.id as string },
        create: {
          id: row.id as string,
          recipientId: row.recipientId as string,
          type: row.type as "TRANSACTION_VOIDED" | "SESSION_VOIDED" | "TEST",
          title: row.title as string,
          body: row.body as string,
          metadata: row.metadata ?? undefined,
          readAt: toDate(row.readAt),
          createdAt: toDate(row.createdAt) ?? undefined,
        },
        update: { readAt: toDate(row.readAt) },
      });
      break;
  }
}
