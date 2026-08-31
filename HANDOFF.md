# HANDOFF

Branch `zcode`, last commit `9095084`.
**The Warung Books merge is CODE-COMPLETE — all 6 slices (0-5) are committed.**
Per-slice detail lives in the commit messages; don't re-derive it here.

**On top of it, UNCOMMITTED, sit three more bodies of work:** (1) the UI/IA
redesign — spec, mockups and the design system in `docs/redesign/`, Phase 0
tokens/fonts/`components/shell/*`, the new `/beranda`, `/kas`, `/buku`,
`/buku/setup`, `/akun` screens, and the `/kasir` reskin; (2) a security and
money pass on the cashier sync and login paths; (3) the parity suites that
hold both to the pre-branch bar. The rollout status per route lives in
`docs/redesign/design.md` section 9 — update it with every phase. `/kas` is
next. `/cashregister`, `/admin/cash-register` and `/expenses` still render
beside their replacements; retiring them to redirects is part of their phase.

**The `/kasir` reskin is styling only.** Adi decided 2026-08-31 to keep the
current flow: the "Buat Sesi" gate stays and the split-bill flow is unchanged,
so the mockup's Favorit and Keypad tabs were deliberately NOT built.

> ## ⚠️ NEXT: THE UAT. Nothing has ever run for real.
> Every `/admin/keuangan/*` page and action is `requireOwner()`-gated. Claude
> cannot log in, so across the entire build **no guarded server action has ever
> executed** — every "live pass" rendered real components with fabricated data
> through a temporary unguarded route under `app/auth/`, since deleted.
> **No journal entry has ever been written by the real UI.**
>
> The checklist is in memory: **`project_warungbooks_uat.md`** (indexed in
> MEMORY.md). It is the acceptance gate, not a formality. Run it before cutover.

## Do these three things first — they block everything else
Nothing can post until all three are done, and they have blocked real testing
since Slice 3a:
1. `/admin/keuangan/akun` → **"Isi akun default"** (seeds the chart of accounts).
2. `/admin/keuangan/akun` → create the real kas accounts (Kas Laci, Kas Pak Har,
   Bank…). Cash accounts are deliberately NOT seeded — you define them.
3. `/admin/keuangan/akun-penjualan` → map **all three** channels (tunai,
   elektronik, online) to kas accounts.
Also `/admin/keuangan/kategori` → "Isi kategori default" before any pengeluaran.
**Take a backup at `/admin/backup` first.** The UAT writes real rows into the
production ledger; prefer a dedicated test month.

## ☠ DATABASE — read before any DB command
- **`.env` is PRODUCTION** (Supabase `oyvgyhuzvxepteldlghn`). There is NO dev DB.
  `.env.claude.local` belongs to a DIFFERENT project — never point kasir at it.
  **pglite (in-process, `npm test`) is the only dev database.** No local
  Postgres, no Docker, no `pg_dump` on this machine.
- `prisma.config.ts` does `import "dotenv/config"` → every bare `prisma` CLI
  command targets PROD. Verify the printed host every time.
- **Prod's migration history is INCOMPLETE**: `_prisma_migrations` records only 4
  of 8. `add_developer_role`, `add_ingredient_recipes`,
  `add_unit_class_and_ingredient_extras`, `widen_costs_to_float` are unrecorded
  and would be treated as PENDING — and `widen_costs_to_float` ALTERs money
  columns. **NEVER `prisma migrate deploy` / `db push` / `migrate reset` here.**
  Additive DDL goes via `prisma db execute` on a reviewed `BEGIN; … COMMIT;`
  file, then `prisma migrate resolve --applied`.
- Policy: **additive only** — no deletes, no edits to existing data or structure.
- The whole merge added exactly ONE migration (`20260726000000_warung_books`,
  applied 2026-07-27). Slices 1-5 added none; the retired tables are DORMANT
  (models kept in `schema.prisma`, data untouched, still backed up).

## ☠ A test once hit production (2026-07-28)
Modules under `app/actions/**` close over the Prisma singleton, which reads
`DATABASE_URL` = PROD, and vitest auto-loads `.env`. A test imported one and ran
real read-only SELECTs against production. **`test/env-guard.ts`** (a vitest
`setupFile`) now neutralizes those vars before any test module loads, and also
releases each file's pglite instance so the suite stops OOMing. **Do not remove
it to make a test pass.** Query-layer functions take an injectable
`db: PrismaClient = prisma` — test the `lib/` function, never the `"use server"`
wrapper.

## Rules that keep biting if forgotten
- Every export of a `"use server"` file is a **callable POST endpoint**. Pure
  logic lives in `lib/` (injectable `db`); `app/actions/admin/queries/*` are thin
  `requireOwner()` wrappers. Every such file needs `"use server"` on line 1 and
  only async exports, or `prisma`/`pg` leaks into the client bundle and the
  Turbopack build dies on `pg/lib/connection-parameters.js`.
- `app/actions/admin/queries.ts` is a SEPARATE compat re-export from
  `queries/index.ts`. Adding a query module means updating **both**.
- ⚠ `queries/_shared.ts` has no `"use server"` and must stay that way — adding it
  would silently turn `reconcileCashDates` into an unauthenticated endpoint.
- Any column of figures on screen must add up to the total shown against it. That
  has been a real bug three times (laporan Gaji, Neraca Ekuitas, Laba Rugi).
- A retained React error boundary replays old errors forever — judge console
  cleanliness in a **fresh tab**, or you will chase a fixed bug.

## Cutover — two consequences already live
- **Laporan reads the LEDGER only.** Pre-cutover pengeluaran still sitting in the
  dormant `Expense` table no longer appear in any report. Rows are intact and
  backed up, just invisible. Re-enter what matters via Saldo Awal / pengeluaran,
  or accept the gap.
- **Locked month vs tutup kas:** if a month is locked and a cashier closes a
  register dated inside it, the kas closes normally but the entry does NOT reach
  the buku besar — the day shows "Belum tercatat ke buku besar" on Kas Harian,
  recoverable by the owner button after unlocking. By design, and documented in
  the petunjuk.

Cutover itself: pick a date, count real cash, enter via **Saldo Awal**, and let
postings flow from there. Correct mistakes by **voiding** — the ledger is
append-only; never delete journal rows.

## The money gate on the cashier sync (2026-08-31)
`pushTransaction` used to accept ANY payload with no auth and no validation. It
now runs `requireAuth()` + `lib/kasir-payload.ts` (zod shapes) +
`lib/kasir-money.ts` (the money model). Two rules keep that from eating real
sales, both regression-tested in `test/money-parity.test.ts`:
- **Cashier identity is NOT enforced.** An offline sale is often synced after a
  shift change by whoever is signed in; requiring the pusher to be the cashier
  named on the sale stranded it forever.
- **The subtotal-vs-items check only applies to a FRESH payment**
  (`origin: "payment"`). `retryUnsyncedTransactions` re-reads the item list at
  retry time, so a drifted retry is recorded and logged, never rejected.
The sync path only retries and `console.error`s, so **any rejection is a
silently lost sale** — never tighten this gate without extending that suite.

## State
`npm test` 263 passed + 1 skipped · tsc, lint, build clean.
Backup coverage includes all 10 WB tables plus the dormant ones. The
backup→restore round-trip is **still unverified end-to-end** (no ledger rows
existed during the build) — it is in the UAT.
`prisma/sql/2026-08-add-transaction-indexes.sql` is written but NOT applied;
apply it by the reviewed-file procedure above, never by `migrate deploy`.
