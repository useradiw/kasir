/**
 * Production DB cleanup script.
 * Removes test data while preserving Staff accounts and auth users.
 *
 * Usage: npx tsx scripts/cleanup-db.ts
 *
 * Tables DELETED:
 *   - OrderItem, TableSession, Transaction
 *   - ExpenseItem, Expense
 *   - AttendanceRecord
 *   - CashRegister
 *
 * Tables KEPT:
 *   - Staff (accounts + Supabase links)
 *   - Category, MenuItem, MenuVariant, Package, PackageItem (menu data)
 */

import "dotenv/config";
import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Starting database cleanup...\n");

  // Order matters due to foreign keys (delete children first)
  const steps: [string, () => Promise<{ count: number }>][] = [
    ["OrderItem", () => prisma.orderItem.deleteMany()],
    ["Transaction", () => prisma.transaction.deleteMany()],
    ["TableSession", () => prisma.tableSession.deleteMany()],
    ["ExpenseItem", () => prisma.expenseItem.deleteMany()],
    ["Expense", () => prisma.expense.deleteMany()],
    ["AttendanceRecord", () => prisma.attendanceRecord.deleteMany()],
    ["CashRegister", () => prisma.cashRegister.deleteMany()],
  ];

  for (const [name, action] of steps) {
    const result = await action();
    console.log(`  ✓ ${name}: ${result.count} rows deleted`);
  }

  // Report what's kept
  const [staffCount, categoryCount, menuItemCount] = await Promise.all([
    prisma.staff.count(),
    prisma.category.count(),
    prisma.menuItem.count(),
  ]);

  console.log("\n📋 Preserved data:");
  console.log(`  Staff: ${staffCount}`);
  console.log(`  Categories: ${categoryCount}`);
  console.log(`  Menu Items: ${menuItemCount}`);
  console.log("\n✅ Cleanup complete.");
}

main()
  .catch((e) => {
    console.error("❌ Cleanup failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
