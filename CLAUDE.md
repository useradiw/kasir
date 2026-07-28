# kasir — Toko Kencana POS

Point-of-sale + COGS/inventory app for Toko Kencana. Live in production at
kasir.tokokencana.com (Vercel). Real business data — the DB is PRODUCTION Supabase.

## Stack

- Next.js 16 (App Router), React 19, TypeScript
- Prisma 6 + Supabase Postgres (via @prisma/adapter-pg) — PRODUCTION
- Dexie 4 (offline-first cashier flow), TanStack Query, shadcn/base-ui, Tailwind
- jsPDF + autotable (receipts/reports), recharts (laporan charts)

## Commands

- Dev: `npm run dev` (or `npm run dev:claude` for the Claude-friendly dev script)
- Build: `npm run build` (runs prisma generate first)
- Lint: `npm run lint`
- Done = lint + build + hydration check pass, AND visual verify in dev server.
- Automated coverage is thin (June 2026 audit finding); the COGS suite was
  retired in Slice 1 (Warung Books merge) along with the COGS screens. When
  touching money paths (checkout totals, laporan aggregation, keuangan), offer
  to extend the suite with a smoke test in the same session.

## ☠ DATABASE LANDMINES — read before any DB command

- **NEVER run `prisma migrate deploy` or `prisma db push` against prod.** Prod's
  `_prisma_migrations` records only **3 of 7** migrations (verified 2026-07-27).
  These 4 are unrecorded and would be treated as pending and re-applied:
  `add_developer_role`, `add_ingredient_recipes`,
  `add_unit_class_and_ingredient_extras`, `widen_costs_to_float`. Their changes are
  already present (prod was evolved with `db push`; `init` is a stale snapshot that
  does NOT reproduce the prod schema). Re-applying is at best an error — and
  `widen_costs_to_float` ALTERs existing **cost columns**, so at worst it destroys
  money data. Fixing this needs a column-by-column audit of prod first.
- **How to apply DDL to prod:** additive only, via `prisma db execute` on a reviewed
  `.sql` file wrapped in `BEGIN; ... COMMIT;` (migration files ship unwrapped), then
  `prisma migrate resolve --applied <name>`.
- **There is NO dev database.** `.env` = PRODUCTION (`oyvgyhuzvxepteldlghn`).
  `.env.claude.local` (`ytuyawfpcdamtelwtrdw`) belongs to a **different project** —
  never point kasir's schema at it. **pglite** (in-process, `npm test`) is the only
  dev DB. No local Postgres, no Docker, no `pg_dump` on this machine.
- `prisma.config.ts` does `import "dotenv/config"` → loads `.env` = **PROD**. Every
  bare `prisma` CLI command targets production. Verify the printed host every time.
- **Take a backup first** (`/admin/backup`, Owner-only) before any prod DB work.
  `backup-*.json` is gitignored — it holds real transactions, staff and salaries.

## Project rules

- **Production DB.** Additive migrations only. Never drop/truncate.
- Branch order for commits: current-month branch (e.g. `june`) → `develop` →
  `master`, in that order. I commit manually; you only propose messages.
- Roles: Owner, Manager, Cashier, Staff, DEVELOPER — permission changes need my
  explicit approval per role.
- Memory system lives at
  `C:\Users\62852\.claude\projects\D--Website-adi-kasir\memory\` — read MEMORY.md
  there FIRST (it defines reading order) instead of exploring the codebase.
- Hydration errors are a recurring failure mode here — check for them after any
  client-state change (Dexie/useSyncExternalStore patterns).
- COGS design is deliberately simple: last-purchase cost + one free-text unit per
  ingredient. Do NOT reintroduce UnitClass/pack-conversion/weighted-average
  complexity — that design failed three times.
- User-facing docs: the "Petunjuk Penggunaan" pages must be updated when features
  change — written in very simple words, in Indonesian where the UI is Indonesian.

## Current state

Mature, in daily production use. Work is incremental: bug fixes, COGS refinement,
laporan improvements. Check HANDOFF.md for the live thread of work.
