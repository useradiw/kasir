"use server";

import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";

// NOTE: this list and IMPORT_ORDER in ./restore.ts must ALWAYS be updated
// together — a table exported but not restorable makes the backup a dead end.
// The Warung Books ledger tables are included (added 2026-07-27); their BigInt
// amounts are serialized as strings by the download path's replacer in
// app/admin/backup/backup-client.tsx, and parsed back in ./restore.ts.
const ALL_TABLES = [
  "categories",
  "menuItems",
  "menuVariants",
  "packages",
  "packageItems",
  "menuItemOnlinePrices",
  "staff",
  "suppliers",
  "ingredients",
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
  "ingredientPurchases",
  "ingredientLogs",
  "ingredientRecipes",
  "ingredientRecipeItems",
  "stockOpnames",
  "stockOpnameLines",
  // --- Warung Books ledger ---
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
      case "suppliers":
        result.suppliers = await prisma.supplier.findMany();
        break;
      case "ingredients":
        result.ingredients = await prisma.ingredient.findMany();
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
      case "ingredientPurchases":
        result.ingredientPurchases = await prisma.ingredientPurchase.findMany({ orderBy: { purchasedAt: "asc" } });
        break;
      case "ingredientLogs":
        result.ingredientLogs = await prisma.ingredientLog.findMany({ orderBy: { createdAt: "asc" } });
        break;
      case "ingredientRecipes":
        result.ingredientRecipes = await prisma.ingredientRecipe.findMany();
        break;
      case "ingredientRecipeItems":
        result.ingredientRecipeItems = await prisma.ingredientRecipeItem.findMany();
        break;
      case "stockOpnames":
        result.stockOpnames = await prisma.stockOpname.findMany({ orderBy: { performedAt: "asc" } });
        break;
      case "stockOpnameLines":
        result.stockOpnameLines = await prisma.stockOpnameLine.findMany();
        break;

      // --- Warung Books ledger ---
      case "ledgerAccounts":
        result.ledgerAccounts = await prisma.ledgerAccount.findMany();
        break;
      case "expenseCategories":
        result.expenseCategories = await prisma.expenseCategory.findMany();
        break;
      case "sequences":
        result.sequences = await prisma.sequence.findMany();
        break;
      case "accountingMonths":
        result.accountingMonths = await prisma.accountingMonth.findMany();
        break;
      case "salesChannelAccounts":
        result.salesChannelAccounts = await prisma.salesChannelAccount.findMany();
        break;
      case "accountingSettings":
        result.accountingSettings = await prisma.accountingSetting.findMany();
        break;
      case "balanceAssertions":
        result.balanceAssertions = await prisma.balanceAssertion.findMany();
        break;
      case "journalEntries":
        result.journalEntries = await prisma.journalEntry.findMany({ orderBy: { createdAt: "asc" } });
        break;
      case "journalLines":
        result.journalLines = await prisma.journalLine.findMany();
        break;
      case "ledgerPostings":
        result.ledgerPostings = await prisma.ledgerPosting.findMany();
        break;
    }
  }

  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    tables: result,
  };
}
