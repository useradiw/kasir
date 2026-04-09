/**
 * Production DB cleanup script.
 * Wipes all data except Staff accounts and auth users.
 *
 * Usage: npx tsx scripts/cleanup-db.ts
 *
 * Tables DELETED:
 *   - OrderItem, Transaction, TableSession
 *   - ExpenseItem, Expense
 *   - AttendanceRecord, CashRegister
 *   - PackageItem, MenuVariant, Package, MenuItem, Category
 *
 * Tables KEPT:
 *   - Staff (accounts + Supabase links)
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
    ["PackageItem", () => prisma.packageItem.deleteMany()],
    ["MenuVariant", () => prisma.menuVariant.deleteMany()],
    ["Package", () => prisma.package.deleteMany()],
    ["MenuItem", () => prisma.menuItem.deleteMany()],
    ["Category", () => prisma.category.deleteMany()],
  ];

  for (const [name, action] of steps) {
    const result = await action();
    console.log(`  ✓ ${name}: ${result.count} rows deleted`);
  }

  // Report what's kept
  const staffCount = await prisma.staff.count();

  console.log("\n📋 Preserved data:");
  console.log(`  Staff: ${staffCount}`);
  console.log("\n✅ Cleanup complete.");
}

main()
  .catch((e) => {
    console.error("❌ Cleanup failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
