# kasir — Toko Kencana POS

Point-of-sale + double-entry bookkeeping (Warung Books) app for Toko Kencana.
Live in production at kasir.tokokencana.com (Vercel). Real business data — the DB
is PRODUCTION Supabase.

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

- **NEVER run `prisma migrate deploy` or `prisma db push` against prod.** The
  migration history was squashed (2026-09-02) to one `init` plus
  `journal_number_unique`, and the database moved to Supabase project
  `ktcaaasmrryoxinsutzt`. See HANDOFF.md's DATABASE section for the full
  provenance before touching anything.
- **How to apply DDL to prod:** additive only, via `prisma db execute` on a reviewed
  `.sql` file wrapped in `BEGIN; ... COMMIT;` (migration files ship unwrapped), then
  `prisma migrate resolve --applied <name>`.
- **There is NO dev database.** `.env` = PRODUCTION (`ktcaaasmrryoxinsutzt`).
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
  `master`, in that order. I merge into `develop` and `master` myself.
- This repo IS on the commit allowlist in `~/.claude/hooks/git-guard.js`: Claude
  may run `git commit` here on my explicit "commit" order, but only from a
  feature or month branch — the hook refuses commits on `master` and `develop`,
  and refuses `git push` entirely. Never commit proactively.
- Roles: Owner, Manager, Cashier, Staff, DEVELOPER — permission changes need my
  explicit approval per role.
- Memory system lives at
  `C:\Users\62852\.claude\projects\D--Website-adi-kasir\memory\` — read MEMORY.md
  there FIRST (it defines reading order) instead of exploring the codebase.
- Hydration errors are a recurring failure mode here — check for them after any
  client-state change (Dexie/useSyncExternalStore patterns).
- The COGS/ingredient-recipe system is fully retired (models, screens, backup
  sections — gone in the Warung Books merge). Pengeluaran Bahan Baku now comes
  from pengeluaran posted to the `Expenses:BahanBaku:*` bucket (renamed from
  HPP / `Expenses:HPP:*` on 2026-09-06, along with Biaya Operasional ->
  Pengeluaran Operasional). Do NOT reintroduce per-item ingredient
  recipes — that design failed three times.
- User-facing docs: the "Petunjuk Penggunaan" pages must be updated when features
  change — written in very simple words, in Indonesian where the UI is Indonesian.

## Current state

Mature, in daily production use. Work is incremental: bug fixes, keuangan
refinement, laporan improvements. Check HANDOFF.md for the live thread of work.
