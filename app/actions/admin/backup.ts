"use server";

import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";

export async function exportDatabase(tables: string[]) {
  await requireOwner();

  const allTables = [
    "categories",
    "menuItems",
    "menuVariants",
    "packages",
    "packageItems",
    "staff",
    "expenses",
    "expenseItems",
    "tableSessions",
    "orderItems",
    "transactions",
    "cashRegisters",
    "attendanceRecords",
  ];

  const selected = tables.length > 0 ? tables.filter((t) => allTables.includes(t)) : allTables;

  const result: Record<string, unknown[]> = {};

  for (const table of selected) {
    switch (table) {
      case "categories":
        result.categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
        break;
      case "menuItems":
        result.menuItems = await prisma.menuItem.findMany();
        break;
      case "menuVariants":
        result.menuVariants = await prisma.menuVariant.findMany();
        break;
      case "packages":
        result.packages = await prisma.package.findMany();
        break;
      case "packageItems":
        result.packageItems = await prisma.packageItem.findMany();
        break;
      case "staff":
        result.staff = await prisma.staff.findMany();
        break;
      case "expenses":
        result.expenses = await prisma.expense.findMany({ include: { items: true } });
        break;
      case "expenseItems":
        // Included via expenses.items, skip standalone
        break;
      case "tableSessions":
        result.tableSessions = await prisma.tableSession.findMany();
        break;
      case "orderItems":
        result.orderItems = await prisma.orderItem.findMany();
        break;
      case "transactions":
        result.transactions = await prisma.transaction.findMany();
        break;
      case "cashRegisters":
        result.cashRegisters = await prisma.cashRegister.findMany();
        break;
      case "attendanceRecords":
        result.attendanceRecords = await prisma.attendanceRecord.findMany();
        break;
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    tables: result,
  };
}
