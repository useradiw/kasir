# Warung Books — migration runbook

The whole WB ledger (Slices 0–5) ships as ONE additive migration:
`prisma/migrations/20260726000000_warung_books/migration.sql`.

It creates 10 new tables + 3 enums and **touches no existing tokokencana table**.
All three foreign keys point at WB tables only, so applying it cannot lock or
alter live catalog / kasir / order data.

Tables: `ledger_accounts`, `journal_entries`, `journal_lines`,
`balance_assertions`, `expense_categories`, `sequences`, `accounting_months`,
`sales_channel_accounts`, `accounting_settings`, `ledger_postings`.

## Applying it

**A database that already has the WB tables** (the dev/Supabase DB, where the
DDL was applied by hand with `prisma db execute` during development) — record it
as applied instead of re-running it, otherwise `migrate deploy` fails on
already-existing tables:

```bash
npx prisma migrate resolve --applied 20260726000000_warung_books
```

Already done on the dev database (2026-07-26); `prisma migrate status` reports
"Database schema is up to date!".

**A database that does NOT have the WB tables yet** (production) — normal deploy:

```bash
npx prisma migrate deploy
```

Check `npx prisma migrate status` first. If it reports `0_init` as pending there,
STOP: `0_init` is a dev-snapshot transform (it renames Better Auth columns and
more) and must never be run against a populated database. Baseline it first with
`prisma migrate resolve --applied 0_init`, then deploy.

## Verification

`test/setup.ts` executes this exact migration file to build the in-process
Postgres the suite runs against — the test run is the proof that the SQL is valid
and complete. There is deliberately no separate DDL fixture to drift from it.

Re-check a live database against the schema at any time with:

```bash
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
```

On the dev DB this currently reports only the **pre-existing drift** unrelated to
Warung Books — `users.supabase_user_id`, the legacy `Customer` table, and a set
of `DROP DEFAULT`s on `updatedAt` columns. Leave those alone; reconciling them is
a separate open task. If that diff ever mentions a WB table, the migration and
`schema.prisma` have diverged.

## Still open

`0_init` remains non-deployable to an empty database, so a from-scratch
environment cannot be built from migration history yet. That reconcile is
tracked separately and is not part of the Warung Books work.
