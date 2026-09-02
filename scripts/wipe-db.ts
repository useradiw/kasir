/**
 * wipe-db.ts — delete ALL data so the shop can be reset. Replaces the old
 * cleanup-db.ts (which targeted the retired schema and is now deleted).
 *
 * Data only, never DDL — no table is dropped or altered.
 *
 * Guards (all mandatory, checked before anything is deleted):
 *   - Refuses unless --yes is passed. Without it: print the row count per
 *     table and exit 0, having changed nothing. That dry run is the default.
 *   - Hard denylist: refuses (exit 1) if the resolved project ref is
 *     "oyvgyhuzvxepteldlghn" (the retired production project) — whatever
 *     flags are passed.
 *   - Same project-ref guard as scripts/dev-accounts.mjs: refuses if
 *     DATABASE_URL and NEXT_PUBLIC_SUPABASE_URL name different projects.
 *   - By default PRESERVES staff rows whose username starts with "dev." (and
 *     their Supabase auth users, by never touching them) so the wipe does not
 *     lock us out. Pass --include-dev-accounts to remove those too (DB rows
 *     only — Supabase auth users are never touched by this script; use
 *     scripts/dev-accounts.mjs delete for that).
 *
 * Usage:
 *   npx tsx scripts/wipe-db.ts                        # dry run — counts only
 *   npx tsx scripts/wipe-db.ts --yes                   # wipe, keep dev.* staff
 *   npx tsx scripts/wipe-db.ts --yes --include-dev-accounts
 */

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", override: false });

import { PrismaClient } from "../generated/prisma";

const RETIRED_PRODUCTION_PROJECT_REF = "oyvgyhuzvxepteldlghn";
const DEV_USERNAME_PREFIX = "dev.";

const prisma = new PrismaClient();

function projectRef(value: string | undefined): string | null {
  const m = /(?:postgres\.|https:\/\/)([a-z]{20})/.exec(value ?? "");
  return m ? m[1] : null;
}

function requireSafeProject(): string {
  const dbRef = projectRef(process.env.DIRECT_URL || process.env.DATABASE_URL);
  const authRef = projectRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log(`  database project: ${dbRef ?? "UNKNOWN"}`);
  console.log(`  auth project:     ${authRef ?? "UNKNOWN"}`);

  if (dbRef === RETIRED_PRODUCTION_PROJECT_REF || authRef === RETIRED_PRODUCTION_PROJECT_REF) {
    throw new Error(
      `REFUSED: "${RETIRED_PRODUCTION_PROJECT_REF}" is the retired production project. ` +
        "This script will never run against it, no matter what flags are passed.",
    );
  }
  if (!dbRef || !authRef) {
    throw new Error("Could not read the project ref from DATABASE_URL/DIRECT_URL or NEXT_PUBLIC_SUPABASE_URL.");
  }
  if (dbRef !== authRef) {
    throw new Error(
      `Database and auth point at DIFFERENT Supabase projects (${dbRef} vs ${authRef}). ` +
        "Fix .env / .env.local before wiping anything.",
    );
  }
  return dbRef;
}

// ---------------------------------------------------------------------------
// Table order — children before parents, respecting every FK in schema.prisma.
// Staff is handled separately at the end (partial delete, dev.* preserved by
// default) rather than in this list.
// ---------------------------------------------------------------------------

type Step = { name: string; count: () => Promise<number>; del: () => Promise<{ count: number }> };

function steps(): Step[] {
  return [
    { name: "Notification", count: () => prisma.notification.count(), del: () => prisma.notification.deleteMany() },
    {
      name: "SettlementItem",
      count: () => prisma.settlementItem.count(),
      del: () => prisma.settlementItem.deleteMany(),
    },
    {
      name: "SettlementDeduction",
      count: () => prisma.settlementDeduction.count(),
      del: () => prisma.settlementDeduction.deleteMany(),
    },
    {
      name: "OnlineSettlement",
      count: () => prisma.onlineSettlement.count(),
      del: () => prisma.onlineSettlement.deleteMany(),
    },
    { name: "OrderItem", count: () => prisma.orderItem.count(), del: () => prisma.orderItem.deleteMany() },
    { name: "Transaction", count: () => prisma.transaction.count(), del: () => prisma.transaction.deleteMany() },
    { name: "TableSession", count: () => prisma.tableSession.count(), del: () => prisma.tableSession.deleteMany() },
    {
      name: "AttendanceRecord",
      count: () => prisma.attendanceRecord.count(),
      del: () => prisma.attendanceRecord.deleteMany(),
    },
    { name: "CashRegister", count: () => prisma.cashRegister.count(), del: () => prisma.cashRegister.deleteMany() },
    {
      name: "MenuItemOnlinePrice",
      count: () => prisma.menuItemOnlinePrice.count(),
      del: () => prisma.menuItemOnlinePrice.deleteMany(),
    },
    { name: "PackageItem", count: () => prisma.packageItem.count(), del: () => prisma.packageItem.deleteMany() },
    { name: "Package", count: () => prisma.package.count(), del: () => prisma.package.deleteMany() },
    { name: "MenuVariant", count: () => prisma.menuVariant.count(), del: () => prisma.menuVariant.deleteMany() },
    { name: "MenuItem", count: () => prisma.menuItem.count(), del: () => prisma.menuItem.deleteMany() },
    { name: "Category", count: () => prisma.category.count(), del: () => prisma.category.deleteMany() },

    // Ledger — self-referencing FKs (JournalEntry.reversedById, LedgerAccount.parentId)
    // are safe under deleteMany() because it is one DELETE statement covering
    // every row, so no dangling reference is ever visible mid-statement.
    { name: "JournalLine", count: () => prisma.journalLine.count(), del: () => prisma.journalLine.deleteMany() },
    { name: "JournalEntry", count: () => prisma.journalEntry.count(), del: () => prisma.journalEntry.deleteMany() },
    {
      name: "BalanceAssertion",
      count: () => prisma.balanceAssertion.count(),
      del: () => prisma.balanceAssertion.deleteMany(),
    },
    {
      name: "LedgerPosting",
      count: () => prisma.ledgerPosting.count(),
      del: () => prisma.ledgerPosting.deleteMany(),
    },
    {
      name: "ExpenseCategory",
      count: () => prisma.expenseCategory.count(),
      del: () => prisma.expenseCategory.deleteMany(),
    },
    {
      name: "LedgerAccount",
      count: () => prisma.ledgerAccount.count(),
      del: () => prisma.ledgerAccount.deleteMany(),
    },
    {
      name: "SalesChannelAccount",
      count: () => prisma.salesChannelAccount.count(),
      del: () => prisma.salesChannelAccount.deleteMany(),
    },
    {
      name: "AccountingSetting",
      count: () => prisma.accountingSetting.count(),
      del: () => prisma.accountingSetting.deleteMany(),
    },
    {
      name: "AccountingMonth",
      count: () => prisma.accountingMonth.count(),
      del: () => prisma.accountingMonth.deleteMany(),
    },
    { name: "Sequence", count: () => prisma.sequence.count(), del: () => prisma.sequence.deleteMany() },

    // Settings & misc — no dependents left by this point.
    { name: "Setting", count: () => prisma.setting.count(), del: () => prisma.setting.deleteMany() },
    { name: "Supplier", count: () => prisma.supplier.count(), del: () => prisma.supplier.deleteMany() },
    { name: "LoginAttempt", count: () => prisma.loginAttempt.count(), del: () => prisma.loginAttempt.deleteMany() },
  ];
}

async function dryRun() {
  console.log("\nDRY RUN — no data will change. Pass --yes to actually wipe.\n");
  let total = 0;
  for (const step of steps()) {
    const n = await step.count();
    total += n;
    console.log(`  ${String(n).padStart(6)}  ${step.name}`);
  }
  const staffTotal = await prisma.staff.count();
  const devStaff = await prisma.staff.count({ where: { username: { startsWith: DEV_USERNAME_PREFIX } } });
  console.log(`  ${String(staffTotal).padStart(6)}  Staff  (${devStaff} dev.* would be preserved by default)`);
  console.log(`\n  ${total + staffTotal} rows total across ${steps().length + 1} tables.`);
}

async function wipe(includeDevAccounts: boolean) {
  console.log(`\nWiping data${includeDevAccounts ? " (including dev.* staff)" : " — dev.* staff preserved"}...\n`);
  let total = 0;
  for (const step of steps()) {
    const { count } = await step.del();
    total += count;
    console.log(`  ${String(count).padStart(6)}  ${step.name}`);
  }

  const staffWhere = includeDevAccounts
    ? {}
    : { NOT: { username: { startsWith: DEV_USERNAME_PREFIX } } };
  const { count: staffDeleted } = await prisma.staff.deleteMany({ where: staffWhere });
  total += staffDeleted;
  console.log(`  ${String(staffDeleted).padStart(6)}  Staff`);

  console.log(`\n  ${total} rows deleted total.`);
}

async function main() {
  const args = process.argv.slice(2);
  const yes = args.includes("--yes");
  const includeDevAccounts = args.includes("--include-dev-accounts");

  console.log("wipe-db");
  requireSafeProject();

  if (!yes) {
    await dryRun();
    return;
  }
  await wipe(includeDevAccounts);
}

main()
  .catch((e) => {
    console.error(`\nFAILED: ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
