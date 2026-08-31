/**
 * setup.ts — in-process Postgres via pglite + Prisma driver adapter.
 *
 * The schema is applied by executing the consolidated Warung Books migration
 * itself (prisma/migrations/20260726000000_warung_books/migration.sql), so the
 * suite exercises the same SQL that ships to the database — there is no separate
 * fixture that can silently drift from it.
 *
 * The real AccountingRepository runs unchanged against this in-process WASM
 * Postgres — same $transaction / queryRaw / findMany code path as production.
 */

import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { PrismaClient } from "@/generated/prisma";

/**
 * The REAL migration chain, in order — not a fixture copy. Applying every
 * migration (not just warung_books) means the operational tables —
 * transactions, order_items, table_sessions, staff, menu_items — exist too,
 * so the cashier-flow sync logic (push-transaction, day-close reconciliation)
 * can be integration-tested exactly like the ledger repositories could.
 * The suite therefore proves the same SQL that ships to the database.
 */
const MIGRATIONS_DIR = new URL("../prisma/migrations/", import.meta.url);
const MIGRATION_FILES = new Map(
  readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d{14}_/.test(name))
    .sort()
    .map((name) => [
      name,
      readFileSync(new URL(`${name}/migration.sql`, MIGRATIONS_DIR), "utf8"),
    ]),
);

// The rig applies: init (operational tables) → drift shim (columns prod
// gained via db push that init predates) → warung_books (the ledger). The
// COGS-era migrations between init and warung_books are deliberately
// SKIPPED: four of them are unrecorded in prod's _prisma_migrations and were
// never cleanly applicable (they re-create objects prod got via db push —
// replaying them errors with "already exists"). Nothing in the operational
// or ledger schema depends on them; the drift shim carries the pieces that
// matter. See drift-shim.sql and project_migration_history_landmine.
const INIT_SQL = MIGRATION_FILES.get("20260313081616_init");
const WARUNG_BOOKS_SQL = MIGRATION_FILES.get("20260726000000_warung_books");

// See drift-shim.sql for what prod's db-push history added without a record.
const DRIFT_SHIM_SQL = readFileSync(
  new URL("./drift-shim.sql", import.meta.url),
  "utf8",
);

/**
 * Every client handed out by createTestClient, so the suite can release them.
 *
 * pglite is in-process WASM: each instance holds its own heap, and nothing
 * frees it when a test file finishes. With one file per pglite instance the
 * suite accumulated all of them for the whole run and started dying with V8
 * "Array buffer allocation failed" / Zone OOM once the file count grew (first
 * seen at 16 files, Slice 5). `test/env-guard.ts` registers an afterAll that
 * drains this set, so each file's database is released as soon as it is done.
 */
const activeClients = new Set<{ prisma: PrismaClient; pglite: PGlite }>();

/** Disconnect Prisma AND close the underlying pglite — $disconnect alone
 *  leaves the WASM heap allocated, which is the part that actually hurts. */
export async function closeTestClients(): Promise<void> {
  for (const { prisma, pglite } of activeClients) {
    try { await prisma.$disconnect(); } catch { /* teardown must never fail a run */ }
    try { await pglite.close(); } catch { /* idem */ }
  }
  activeClients.clear();
}

export async function createTestClient(extraSqlFiles: string[] = []): Promise<PrismaClient> {
  const pglite = new PGlite();
  await pglite.exec(INIT_SQL);
  await pglite.exec(DRIFT_SHIM_SQL);
  await pglite.exec(WARUNG_BOOKS_SQL);
  // Optional extra DDL — e.g. minimal source tables (kasir_transactions, orders)
  // the sales-posting tests read from. FK-free, test-only.
  for (const rel of extraSqlFiles) {
    const sql = readFileSync(new URL(rel, import.meta.url), "utf8");
    await pglite.exec(sql);
  }

  const adapter = new PrismaPGlite(pglite);
  const prisma = new PrismaClient({
    adapter,
  } as ConstructorParameters<typeof PrismaClient>[0]);

  activeClients.add({ prisma, pglite });
  return prisma;
}

/**
 * Clear all Warung Books tables between tests. TRUNCATE … CASCADE handles FK
 * ordering (journal_lines → journal_entries, ledger_accounts self-FK) atomically.
 * All PKs are TEXT cuids, so there are no identity sequences to restart.
 */
export async function resetDb(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRaw`
    TRUNCATE TABLE
      ledger_postings,
      balance_assertions,
      expense_categories,
      sales_channel_accounts,
      accounting_settings,
      accounting_months,
      journal_lines,
      journal_entries,
      sequences,
      ledger_accounts
    CASCADE
  `;
}
