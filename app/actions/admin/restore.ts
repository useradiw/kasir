"use server";

import { prisma } from "@/lib/prisma";
import { reconcileJournalSequence } from "@/lib/accounting/reconcileJournalSequence";
import { requireOwner } from "@/lib/admin-auth";

export interface BackupData {
  version?: number;
  exportedAt?: string;
  tables: Record<string, unknown[]>;
}

// FK-safe import order.
// Keep in sync with ALL_TABLES in ./backup.ts and TABLE_OPTIONS in
// app/admin/backup/backup-client.tsx — all three lists move together.
const IMPORT_ORDER = [
  "settings",
  "staff",
  "categories",
  "suppliers",
  "menuItems",
  "packages",
  "menuVariants",
  "packageItems",
  "menuItemOnlinePrices",
  "tableSessions",
  "orderItems",
  "transactions",
  "onlineSettlements",
  "settlementItems",
  "settlementDeductions",
  "cashRegisters",
  "attendanceRecords",
  "notifications",
  // --- Warung Books ledger. Parents before children: ledgerAccounts (self-FK
  // parentId is deferred to a second pass) -> journalEntries -> journalLines.
  // ledgerPostings last; it holds plain ids, no FKs. ---
  "ledgerAccounts",
  "expenseCategories",
  "sequences",
  "accountingMonths",
  "salesChannelAccounts",
  "accountingSettings",
  "balanceAssertions",
  "journalEntries",
  "journalLines",
  "ledgerPostings",
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

  await relinkWarungBooksSelfReferences(data, selectedTables, errors);

  // A backup carries `sequences`, so restoring an older file rewinds the
  // journal counter and the next posted entry reuses a number the ledger
  // already has. Move it forward to max(number) before anything can post.
  // Runs whenever journal rows or the counter itself were touched.
  if (selectedTables.includes("journalEntries") || selectedTables.includes("sequences")) {
    try {
      const fixed = await reconcileJournalSequence(prisma);
      if (fixed.repaired) {
        console.warn(
          `[restore] journal sequence moved forward from ${fixed.before ?? "missing"} to ${fixed.after}`,
        );
      }
    } catch (err) {
      errors.push(
        `sequences[journal]: gagal menyesuaikan nomor jurnal — ${err instanceof Error ? err.message : String(err)}`,
      );
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

/**
 * Warung Books amounts are BigInt. The export serializes them as decimal strings
 * (JSON has no BigInt), so accept both. Rejects anything lossy rather than
 * silently rounding — these are money values.
 */
function toBigInt(val: unknown): bigint {
  if (typeof val === "bigint") return val;
  if (typeof val === "string" && /^-?\d+$/.test(val)) return BigInt(val);
  if (typeof val === "number" && Number.isInteger(val)) return BigInt(val);
  throw new Error(`Nilai tidak valid untuk BigInt: ${String(val)}`);
}

/**
 * Second pass for the two self-referencing FKs in the Warung Books tables. They
 * are skipped during the main upsert because a row may reference another row in
 * the same table that has not been inserted yet.
 */
async function relinkWarungBooksSelfReferences(
  data: BackupData,
  selectedTables: string[],
  errors: string[],
): Promise<void> {
  if (selectedTables.includes("ledgerAccounts")) {
    for (const row of (data.tables.ledgerAccounts ?? []) as Record<string, unknown>[]) {
      if (!row.id || !row.parentId) continue;
      try {
        await prisma.ledgerAccount.update({
          where: { id: row.id as string },
          data:  { parentId: row.parentId as string },
        });
      } catch (err) {
        errors.push(`ledgerAccounts[${row.id}].parentId: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  if (selectedTables.includes("journalEntries")) {
    for (const row of (data.tables.journalEntries ?? []) as Record<string, unknown>[]) {
      if (!row.id || !row.reversedById) continue;
      try {
        await prisma.journalEntry.update({
          where: { id: row.id as string },
          data:  { reversedById: row.reversedById as string },
        });
      } catch (err) {
        errors.push(`journalEntries[${row.id}].reversedById: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
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

    case "suppliers":
      await prisma.supplier.upsert({
        where: { id: row.id as string },
        create: {
          id:       row.id as string,
          name:     row.name as string,
          phone:    row.phone as string | null ?? undefined,
          notes:    row.notes as string | null ?? undefined,
          isActive: row.isActive as boolean ?? true,
          createdAt: toDate(row.createdAt) ?? undefined,
        },
        update: { name: row.name as string, phone: row.phone as string | null ?? undefined, notes: row.notes as string | null ?? undefined },
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
        update: { label: row.label as string, amount: row.amount as number },
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

    // ─── Warung Books ledger ────────────────────────────────────────────────
    // Self-referencing FKs (ledgerAccounts.parentId, journalEntries.reversedById)
    // are NOT set here — a parent may not exist yet when its child is upserted.
    // relinkWarungBooksSelfReferences() wires them up after every row is in.

    case "ledgerAccounts":
      await prisma.ledgerAccount.upsert({
        where:  { id: row.id as string },
        create: {
          id:     row.id as string,
          code:   row.code as string,
          name:   row.name as string,
          label:  row.label as string | null ?? undefined,
          type:   row.type as "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE",
          active: row.active as boolean ?? true,
        },
        update: {
          code:   row.code as string,
          name:   row.name as string,
          label:  row.label as string | null ?? undefined,
          type:   row.type as "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE",
          active: row.active as boolean ?? true,
        },
      });
      break;

    case "expenseCategories":
      await prisma.expenseCategory.upsert({
        where:  { id: row.id as string },
        create: {
          id:        row.id as string,
          code:      row.code as string,
          name:      row.name as string,
          bucket:    row.bucket as "HPP" | "OPEX",
          active:    row.active as boolean ?? true,
          createdAt: toDate(row.createdAt) ?? undefined,
        },
        update: {
          name:   row.name as string,
          bucket: row.bucket as "HPP" | "OPEX",
          active: row.active as boolean ?? true,
        },
      });
      break;

    case "sequences":
      await prisma.sequence.upsert({
        where:  { id: row.id as string },
        create: { id: row.id as string, key: row.key as string, value: row.value as number ?? 0 },
        update: { value: row.value as number ?? 0 },
      });
      break;

    case "accountingMonths":
      await prisma.accountingMonth.upsert({
        where:  { id: row.id as string },
        create: {
          id:        row.id as string,
          month:     row.month as string,
          lockedAt:  toDate(row.lockedAt) ?? undefined,
          createdAt: toDate(row.createdAt) ?? undefined,
        },
        update: { lockedAt: toDate(row.lockedAt) },
      });
      break;

    case "salesChannelAccounts":
      await prisma.salesChannelAccount.upsert({
        where:  { id: row.id as string },
        create: { id: row.id as string, channel: row.channel as string, account: row.account as string },
        update: { account: row.account as string },
      });
      break;

    case "accountingSettings":
      await prisma.accountingSetting.upsert({
        where:  { id: row.id as string },
        create: { id: row.id as string, key: row.key as string, value: row.value as string },
        update: { value: row.value as string },
      });
      break;

    case "balanceAssertions":
      await prisma.balanceAssertion.upsert({
        where:  { id: row.id as string },
        create: {
          id:        row.id as string,
          account:   row.account as string,
          date:      row.date as string,
          expected:  toBigInt(row.expected),
          note:      row.note as string | null ?? undefined,
          createdBy: row.createdBy as string,
          createdAt: toDate(row.createdAt) ?? undefined,
        },
        update: {
          expected: toBigInt(row.expected),
          note:     row.note as string | null ?? undefined,
        },
      });
      break;

    case "journalEntries":
      await prisma.journalEntry.upsert({
        where:  { id: row.id as string },
        create: {
          id:         row.id as string,
          number:     row.number as number | null ?? undefined,
          state:      row.state as "DRAFT" | "POSTED" | "VOID",
          date:       row.date as string,
          narration:  row.narration as string,
          postedAt:   toDate(row.postedAt) ?? undefined,
          createdAt:  toDate(row.createdAt) ?? undefined,
          sourceType: row.sourceType as string | null ?? undefined,
          sourceMeta: (row.sourceMeta ?? undefined) as never,
        },
        update: {
          number:    row.number as number | null ?? undefined,
          state:     row.state as "DRAFT" | "POSTED" | "VOID",
          narration: row.narration as string,
          postedAt:  toDate(row.postedAt) ?? undefined,
        },
      });
      break;

    case "journalLines":
      await prisma.journalLine.upsert({
        where:  { id: row.id as string },
        create: {
          id:      row.id as string,
          entryId: row.entryId as string,
          account: row.account as string,
          amount:  toBigInt(row.amount),
        },
        update: { account: row.account as string, amount: toBigInt(row.amount) },
      });
      break;

    case "ledgerPostings":
      await prisma.ledgerPosting.upsert({
        where:  { id: row.id as string },
        create: {
          id:             row.id as string,
          sourceType:     row.sourceType as string,
          sourceId:       row.sourceId as string,
          journalEntryId: row.journalEntryId as string,
          createdAt:      toDate(row.createdAt) ?? undefined,
        },
        update: { journalEntryId: row.journalEntryId as string },
      });
      break;
  }
}
