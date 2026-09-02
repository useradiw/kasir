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
 * The REAL migration chain, in order — not a fixture copy. The suite therefore
 * proves the same SQL that ships to the database.
 *
 * Since 2026-09-02 that chain is a single init: kasir moved to a fresh
 * database, and the old eight-migration chain (whose replay needed a
 * hand-written drift shim, because prod had been evolved with `db push`) was
 * replaced by one migration generated from the schema. Every migration found
 * here is applied, in filename order, with nothing skipped and nothing shimmed
 * — so adding a migration needs no change to this file.
 */
const MIGRATIONS_DIR = new URL("../prisma/migrations/", import.meta.url);
const MIGRATION_SQL = readdirSync(MIGRATIONS_DIR)
  .filter((name) => /^\d{14}_/.test(name))
  .sort()
  .map((name) => readFileSync(new URL(`${name}/migration.sql`, MIGRATIONS_DIR), "utf8"));

if (MIGRATION_SQL.length === 0) {
  throw new Error("No migrations found in prisma/migrations — the test schema would be empty.");
}

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
  for (const sql of MIGRATION_SQL) {
    await pglite.exec(sql);
  }
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
