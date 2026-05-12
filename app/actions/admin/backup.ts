"use server";

import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";

const ALL_TABLES = [
  "categories",
  "menuItems",
  "menuVariants",
  "packages",
  "packageItems",
  "menuItemOnlinePrices",
  "staff",
  "expenses",
  "expenseItems",
  "expenseTemplates",
  "tableSessions",
  "orderItems",
  "transactions",
  "cashRegisters",
  "recipes",
  "recipeIngredients",
  "kasPakHar",
  "attendanceRecords",
  "notifications",
  "settings",
  "onlineSettlements",
  "settlementItems",
  "settlementDeductions",
] as const;

export type BackupTableKey = (typeof ALL_TABLES)[number];

export async function exportDatabase(tables: string[]) {
  await requireOwner();

  const selected = tables.length > 0
    ? tables.filter((t): t is BackupTableKey => (ALL_TABLES as readonly string[]).includes(t))
    : [...ALL_TABLES];

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
      case "menuItemOnlinePrices":
        result.menuItemOnlinePrices = await prisma.menuItemOnlinePrice.findMany();
        break;
      case "staff":
        result.staff = await prisma.staff.findMany();
        break;
      case "expenses":
        result.expenses = await prisma.expense.findMany();
        break;
      case "expenseItems":
        result.expenseItems = await prisma.expenseItem.findMany();
        break;
      case "expenseTemplates":
        result.expenseTemplates = await prisma.expenseTemplate.findMany();
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
      case "recipes":
        result.recipes = await prisma.recipe.findMany();
        break;
      case "recipeIngredients":
        result.recipeIngredients = await prisma.recipeIngredient.findMany();
        break;
      case "kasPakHar":
        result.kasPakHar = await prisma.kasPakHar.findMany();
        break;
      case "attendanceRecords":
        result.attendanceRecords = await prisma.attendanceRecord.findMany();
        break;
      case "notifications":
        result.notifications = await prisma.notification.findMany();
        break;
      case "settings":
        result.settings = await prisma.setting.findMany();
        break;
      case "onlineSettlements":
        result.onlineSettlements = await prisma.onlineSettlement.findMany({ orderBy: { settlementDate: "desc" } });
        break;
      case "settlementItems":
        result.settlementItems = await prisma.settlementItem.findMany();
        break;
      case "settlementDeductions":
        result.settlementDeductions = await prisma.settlementDeduction.findMany();
        break;
    }
  }

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    tables: result,
  };
}
