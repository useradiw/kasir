# HANDOFF

Branch `feat/warungbooks` (from `develop`). Warung Books merge — plan at
`D:\Workspace\plan\kasir-warungbooks.md`. Donor is **tokokencana's already-adapted
engine** (`D:\Website\adi\tokokencana\src\lib\accounting\`), not raw Padu.

> ## ⚠️ THERE IS NO DEV DATABASE
> - `.env` = **PRODUCTION** — Supabase `oyvgyhuzvxepteldlghn`, `ap-southeast-1`.
>   Confirmed: `.env.local`'s Auth URL is the same project ref.
> - `.env.claude.local` (`ytuyawfpcdamtelwtrdw`, `ap-northeast-2`) is **NOT kasir's
>   dev DB** — Adi confirmed 2026-07-27 it belongs to ANOTHER PROJECT. Its schema was
>   never kasir's, which is why `test:cogs` fails on it. **Never push/reset/migrate
>   kasir's schema onto it — that would destroy another project's data.**
>   `npm run dev:claude` and `scripts/cogs-test/run.mjs` both still point there
>   (hardcoded); repoint or retire them.
> - **pglite (in-process) is the only real dev database.** Automated tests use it.
> - No local Postgres, no Docker, **no `pg_dump` binary** — the plan's "dump prod
>   before migrating" is currently IMPOSSIBLE. Resolve before any risky prod work.
> - Prod policy (Adi, 2026-07-27): prod may be used, **additive only — no deletes,
>   no edits to existing data or structure**. NEVER `prisma db push`, `migrate
>   deploy`, or `migrate reset` here: recorded migrations do NOT reproduce the prod
>   schema (prod was evolved with `db push`; `init` is a stale snapshot), so a
>   replay or reconcile could drop things. Additive DDL goes via `prisma db execute`.

## ⚠ USER TESTING — do not skip at the end of the build
The plan has **6 slices (0-5)** plus a Cutover. Done: 0, 2, 1. Remaining: 3, 4, 5.

**No guarded server action has EVER run for real.** Every `/admin/keuangan/*` page
and action is `requireOwner()`-gated; Claude cannot log in, so the entire authed
surface is untested — no journal entry has ever been written through the real UI.
The full acceptance checklist lives in memory at
`project_warungbooks_uat.md` (indexed in MEMORY.md) so it survives session
boundaries and HANDOFF rewrites. **Run it before cutover.** It also covers the
backup round-trip, which could not be verified while the ledger had no rows.

## Slice order (changed from the plan, agreed)
0 → **2 (Keuangan/Pengeluaran+HPP)** → **1 (COGS strip)** → 3 → 4 → 5.
Swapped so bahan cost always has somewhere to land; stripping first left a gap.

## Slice 1 — DONE, uncommitted (code-only strip, tables dormant)
COGS/bahan baku code removed; **all 9 Ingredient/Recipe/Opname models + 3 enums
are intact in the DB and in schema.prisma**, physically moved into a marked
`DORMANT — retained for data, not used` block (models AND enums) — zero
migrations generated, schema sorted-diff vs HEAD is empty.
- Deleted: `/admin/ingredients` (+`[id]`), `/admin/bahan/*`, `/admin/stock-opname`,
  `/petunjuk/cogs`, `lib/cogs-utils.ts`, `lib/ingredient-search.ts`,
  `app/actions/admin/{ingredients,ingredient-recipes,ingredient-purchases,recipes,opname}.ts`,
  `app/actions/admin/queries/{ingredient,recipe}-queries.ts`, `scripts/cogs-test/`
  + its `test:cogs` npm script (CLAUDE.md updated to match).
- De-wired: `push-transaction.ts` (cogs always null, no stock movements),
  `admin/transactions.ts` (void no longer reverses stock),
  `admin/expenses.ts` + `actions/expenses.ts` (no purchase recording,
  `ExpenseItem.ingredientId` always written null — column kept),
  `expense-item-row.tsx`/`expense-form.tsx` (ingredient autocomplete removed,
  free-text unit only), `menu-performance-queries.ts` +client (dropped
  cogsPerPortion/totalCogs/grossProfit/marginPct/hasRecipe — no recipe data
  left to derive them from; kept qtySold/revenue), `inventory-client.tsx`
  (dropped the dead "Resep" tab stub), `admin/layout.tsx` (Bahan Baku nav
  group gone, Supplier moved under Keuangan), `revalidate.ts` (dropped
  `revalidateIngredients`/`revalidateOpname`), `queries/index.ts` + the
  `queries.ts` compat shim (both — landmine from Slice 2 notes), `petunjuk/page.tsx`
  (removed Bahan Baku/Satuan/Resep Menu/Resep Olahan/Opname sections + TOC +
  permission-matrix rows), `admin/page.tsx` (dashboard opname-reminder banner
  called the now-deleted `getCurrentMonthOpnameStatus` — removed, this wasn't
  in the original file list, caught by the dangling-import grep).
- Untouched per scope: `backup.ts`/`restore.ts`/`backup-client.tsx` (still
  list all ingredient/recipe/opname tables — dormant data still backed up),
  `app/admin/suppliers/*`, all `lib/accounting/` + `app/admin/keuangan/*`.
- Verified: `tsc --noEmit` clean, `lint` clean, `npm test` 52/52 + 1 skipped
  (unchanged), `npm run build` clean — route list confirms deleted routes gone
  and kept routes (`/admin/inventory`, `/admin/suppliers`, `/admin/menu-performance`,
  `/admin/expenses`, `/expenses`, all 8 `/admin/keuangan*`) present.
- **LIVE PASS DONE (2026-07-28)** via a TEMPORARY `app/auth/dev-slice1/` route
  (only `/` and `/auth/*` escape proxy.ts) rendering the real components with
  fabricated data. **Route DELETED** — confirm with `grep -rn dev-slice1 app/`.
  Verified in-browser: ItemRow has no ingredient dropdown/"HPP terakhir" chip;
  Indonesian comma survives (`0,5` + Rp 5.000 -> `amount 0.5, cost 10000,
  ingredientId null`); the "Riwayat" past-names autocomplete still works;
  menu-performance renders 3 columns (Menu/Terjual/Pendapatan) with correct
  totals and no HPP remnants; /admin/expenses list + item breakdown fine;
  inventory tab bar down to 5 tabs; petunjuk clean. **Zero console errors,
  zero hydration warnings.** ExpenseForm itself could NOT be rendered
  unauthenticated — its `useEffect` calls `getSuppliers()`, whose
  `requireRole()` redirect navigates the whole page away despite the
  `.catch()`. Its diff is prop-removal only and is compile-verified.
- Two fixes made during the live pass, after the agent's run:
  `app/admin/inventory/page.tsx` now validates `?tab=` against `VALID_TABS`
  (a bookmarked `?tab=recipes` rendered a blank body); petunjuk "Diperbarui"
  bumped to 28 Juli 2026.
- **DEFERRED to Slice 3 by decision (2026-07-28):** Adi first chose to delete
  the old expense screens in this slice, then agreed to defer after this was
  found — `cashregister.ts:180` computes `expectedClosing = openingCash +
  cashIncome - totalExpenses` and `report-queries.ts` computes `netProfit` the
  same way, both from the `Expense` table. Deleting those screens before
  Slice 3 wires shift-close and laporan to the ledger would make every shift
  close show a FALSE cash shortfall and overstate net profit, and would leave
  cashiers with no pengeluaran entry at all (`/expenses` is `requireAuth()`,
  `/admin/keuangan/pengeluaran` is `requireOwner()`). So `/expenses`,
  `/admin/expenses` and `/admin/expense-templates` all still work and still
  feed tutup kas + laporan; only the ingredient picker came out.
- Also decided: `/admin/inventory` is menu CRUD, NOT bahan — kept.
  `/admin/suppliers` kept (no ingredient references), moved under Keuangan
  because pembelian in kasir *is* Pengeluaran; there is no separate pembelian
  or penjualan module planned.
- NOT committed — Adi commits manually. Next: Slice 3.

## Slice 0 — DONE (committed 90ecff3; backup coverage 42c7aed)
Engine + WB tables + pglite harness. **52 tests green** (+1 skipped: a live-DB
concurrency test, correctly gated behind `RUN_LIVE_DB_TESTS`); tsc + lint + build
clean. Nothing user-facing, nothing wired.
- `lib/accounting/` (18 files) — copied from tokokencana minus
  `salesPostingRepository` / `purchasePostingRepository` (wired to Order/PO which
  kasir lacks; kasir's equivalents get written fresh in Slice 3).
- `prisma/schema.prisma` +178 lines, **0 deletions** — 10 WB models, 3 enums.
- `prisma/migrations/20260726000000_warung_books/` — consolidated, additive-only
  (all FKs internal to WB). **APPLIED TO PROD 2026-07-27** inside an explicit
  transaction via `prisma db execute` (never `db push`). public tables 32 -> 42;
  3 enums added; all 31 existing tables verified byte-count-identical before and
  after. Recorded via `prisma migrate resolve --applied`. Tables are EMPTY —
  chart of accounts not yet seeded.
- Chart of accounts kasir-native: `Expenses:HPP:Bahan` (not tokokencana's
  `HPP:Barang`), plus `Income`/`Expenses:SelisihKas` for shift-close over/short.
- `lib/errors/index.ts` — `DomainError extends ActionError`. The agent first wrote
  a SECOND parallel taxonomy; corrected so everything flows through kasir's
  existing `runAction` seam. Don't let a donor copy reintroduce the split.
- `tsconfig.json` excludes `test` + `vitest.config.ts`: `pglite-prisma-adapter`
  pins `@prisma/driver-adapter-utils@6.10.1` vs kasir's `adapter-pg@6.19.2` —
  cross-package type conflict. Donor does the same; not a workaround we invented.

## ☠ LANDMINE: prod migration history is INCOMPLETE
Prod `_prisma_migrations` records only 3 of 7 migrations — `init`,
`add_ingredient_model`, and now `warung_books`. These 4 are NOT recorded and would
be treated as PENDING: `add_developer_role`, `add_ingredient_recipes`,
`add_unit_class_and_ingredient_extras`, `widen_costs_to_float`.
**A `prisma migrate deploy` against prod would try to apply all four** — including
`widen_costs_to_float`, which ALTERs existing cost columns. Their changes are
believed already present (prod was evolved with `db push`), so replaying is at best
an error and at worst destructive. Do NOT run `migrate deploy` here. Resolving them
properly needs a column-by-column audit of prod vs each migration first.

## Backup
`backup-2026-07-27.json` (3.4 MB, 7850 rows, 31/31 tables) verified against live
prod: every table count matched exactly. `backup-*.json` + `/backups/` are now
gitignored — the file was sitting untracked in the repo root and a `git add -A`
would have committed real transactions, staff and salary data.

## Post-migration app health check (2026-07-27) — PASSED
Verified the existing app still works against prod WITH the 10 new tables:
- `prisma generate` + `npm run build` clean; `npm test` 52 green.
- Dev server boots against prod; 10 routes probed, **zero server errors**.
  (Note: only `/` renders unauthenticated — the rest 307 to `/`. The auth gate
  works, but a 200 behind `-L` proves nothing; authed clickthrough is still Adi's.)
- `npm run test:cogs` re-run against prod AFTER the migration: 4/4 PASS. Real
  app logic (`lib/cogs-utils.ts`), real writes, rolled back.
- Read-only relational smoke through the regenerated client: 10 nested queries
  covering kasir menu, laporan, pengeluaran, bahan baku, settlement, tutup kas,
  kas pak har, packages, aggregates, recipes — all PASS. All 10 WB tables present,
  queryable, 0 rows.
- Row counts re-verified against the backup after every prod step: unchanged.

## Open / next
1. `npm run test:cogs` FAILS — pre-existing, NOT caused by Slice 0. Root cause is
   the box above: `scripts/cogs-test/run.mjs` hardcodes `.env.claude.local`, which
   is another project's DB, so `categories.sortOrder` / `ingredients.category` are
   missing there. Nothing is wrong with kasir's code. Fix = repoint the harness.
   The harness IS rollback-safe (every test runs in `$transaction` and throws a
   `ROLLBACK` sentinel; nothing commits), so prod is a viable target — use
   `DIRECT_URL` :5432, NOT the pgbouncer pooler :6543, since interactive
   transactions over transaction-mode pooling are unreliable.
   ⚠ `prisma.config.ts` does `import "dotenv/config"` → loads `.env` = **PRODUCTION**.
   Every bare `prisma` CLI command targets PROD. Always override the env explicitly
   and verify the printed host before trusting it.
2. ~~Backup does not cover the WB tables~~ — **DONE 2026-07-27.** All 10 WB tables
   added to all THREE lists that must move together: `ALL_TABLES`
   (actions/admin/backup.ts), `IMPORT_ORDER` (actions/admin/restore.ts), and
   `TABLE_OPTIONS` (admin/backup/backup-client.tsx — a third list that was easy to
   miss; it also still offered the long-deleted `ingredientPacks`, now removed).
   - BigInt: `bigintReplacer` in backup-client.tsx serializes to decimal strings;
     `toBigInt()` in restore.ts parses back and REJECTS non-integers rather than
     rounding. Roundtrip verified exact past `Number.MAX_SAFE_INTEGER`.
   - Self-FKs (`ledgerAccounts.parentId`, `journalEntries.reversedById`) are skipped
     on the main pass and wired by `relinkWarungBooksSelfReferences()` afterwards —
     a row can reference one not yet inserted.
   - NOT yet verified end-to-end: no ledger rows exist to export. Do a real
     backup→restore roundtrip once Slice 2 has posted entries.
   - Still uncovered by design: Supabase Auth users (restore gives staff rows,
     no logins).
3. **Slice 2 — DONE + LIVE-VERIFIED (committed d8a0115).**
   Live pass (2026-07-28): the `/admin/keuangan/*` pages are `requireOwner()`-gated
   and Claude cannot log in, so verification used a TEMPORARY route under
   `app/auth/dev-keuangan/` (only `/` and `/auth/*` escape proxy.ts's redirect)
   rendering the real client components with fabricated populated data.
   **That route has been DELETED** — confirm with `grep -rn dev-keuangan app/`.
   Result: all 4 screens render, Indonesian copy correct, Rupiah formatted,
   zero console errors, no hydration warnings, client logic live (qty x harga
   auto-calc verified in-browser).
   **Bug found and fixed during the live pass:** Pengeluaran's Qty used
   `<Input type="number">`, which silently DISCARDS the comma Indonesian users
   type — `0,5` became empty and the total stayed 0. Now `DecimalInput` (kasir's
   existing control, already used in `components/expenses/expense-item-row.tsx`),
   with a `formKey` remount so the post-save reset actually clears it. Verified
   live: `0,5` -> Rp 5.000, `2,25` -> Rp 22.500. Harga/Jumlah stay numeric
   (whole Rupiah) per the design rule.
   STILL NOT DONE: no authed clickthrough — no guarded server action has ever
   run for real. That is Adi's, as owner. `/admin/keuangan/*` screens: Jurnal, Pengeluaran,
   Transfer, Modal, Prive, Saldo Awal, Kategori, Akun Kas (+ "Isi akun default"
   seeding `seedChartOfAccounts` — chart of accounts is STILL UNSEEDED on prod,
   click it once before anything can post). All gated `requireOwner()`; nav
   entries added under the "Keuangan" trigger group in `app/admin/layout.tsx`
   (`ownerOnly: true`). New files: `lib/keuangan-schema.ts`, `lib/keuangan-month.ts`
   (`wb_month` cookie + `monthRange`), `app/actions/admin/keuangan.ts` (server
   actions), `app/actions/admin/queries/keuangan-queries.ts` (barrel-wired via
   `queries/index.ts` AND the outer `queries.ts` compat shim — both needed, see
   landmine below), `lib/revalidate.ts` +`revalidateKeuangan()`, `app/admin/keuangan/`
   (layout + 8 pages + shared `_components/`).
   - Edit-in-place was deliberately skipped for Pengeluaran/Transfer/Modal/Prive/
     Saldo Awal — only Catat + Void (Hapus), matching the task's minimal screen
     list. The engine supports edit (void+repost); add a form later if needed.
   - Gates: `npm test` 52/52 green, `tsc --noEmit` clean, `lint` clean, `build`
     clean — all 7 new keuangan routes appear in the route list.
   - ☠ **LANDMINE hit + fixed**: every file under `app/actions/admin/queries/`
     MUST start with `"use server"` (all siblings do). Without it, a plain query
     file re-exported through the shared barrel drags `prisma`/`pg` (and its
     `dns`/`fs`/`net`/`tls` Node built-ins) into the CLIENT bundle the moment ANY
     client component imports anything else from that barrel (here:
     `ingredient-detail-client.tsx` importing `adjustIngredientStock`) — Turbopack
     build fails on `pg/lib/connection-parameters.js`. Fix: add `"use server"` to
     `keuangan-queries.ts`; move the one SYNC helper (`monthRange`) out to
     `lib/keuangan-month.ts` since a `"use server"` file requires every export to
     be an async function. Also: the outer `app/actions/admin/queries.ts` is a
     separate compat re-export file from `./queries/index` — bare imports of
     `@/app/actions/admin/queries` resolve to THIS file, not the folder's
     `index.ts`, so both must be updated when adding a new query module.
4. Engine assumptions still tokokencana-shaped, for later slices: HPP feeding
   (kasir posts from Pengeluaran, no per-sale `hargaModal`); `LedgerPosting.
   sourceType` values; `AccountingSetting` key `purchase-cash-account` assumes a
   single purchase source — kasir has `Expense`/`ExpenseItem`/`Ingredient`.
