/**
 * env-guard.ts — vitest setupFile. Runs BEFORE any test module is imported.
 *
 * Why this exists: `.env` in this repo points at the PRODUCTION Supabase
 * database, and vitest's config resolution auto-populates `process.env` from
 * `.env` regardless of the `NEXT_PUBLIC_` prefix rule. Files under
 * `app/actions/admin/queries/` close over the module-level singleton in
 * `lib/prisma.ts`, which builds a `pg` Pool from `DATABASE_URL` at import time.
 * So a test that so much as *imports* a query-layer module would open a
 * connection to production — and a read that returns zeros instead of throwing
 * looks exactly like a passing test on an empty pglite database.
 *
 * That happened once, during Slice 3b: a test issued real read-only SELECTs
 * against production before the mistake was caught. Nothing was written, but
 * the only reason it stayed harmless was luck.
 *
 * Guard: point every DB env var at a closed local port. Anything that tries to
 * reach a real server fails loudly and immediately instead of silently
 * succeeding against prod. The accounting suite is unaffected — it injects a
 * pglite client explicitly and never reads these variables.
 *
 * If you are writing a test for a query-layer function, inject the pglite
 * client (see the optional `db` parameter on the ledger query helpers). Do NOT
 * remove this guard to make a test pass.
 */

const BLOCKED = "postgresql://blocked:blocked@127.0.0.1:1/blocked";

for (const key of ["DATABASE_URL", "DIRECT_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL"]) {
  if (process.env[key]) process.env[key] = BLOCKED;
}
