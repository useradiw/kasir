# HANDOFF

## State — 2026-09-07 (role-permissions worktree)

**Branch `feat/role-permissions` in worktree `D:/Website/adi/kasir-perms`, off
`sept` (cf66e33) — NOT merged. Adi merges.** The capability layer is DONE:
every gate in the app is now `requireCan`/`requireCanStrict` on a named
capability; the role gates (requireRole/requireOwner) are deleted. Day-one
behaviour is unchanged — the seeded grid mirrors the old hardcoded checks, and
test/permissions-matrix.test.ts pins that. Last green: lint clean, `npm test`
419 passed + 1 skipped / 37 files, `npm run build` succeeds.

Owner toggle screen: **/buku/izin** (real OWNER only, no DEVELOPER bypass).
RolePermission table ships as `prisma/sql/2026-09-add-role-permissions.sql`
(BEGIN/COMMIT + 96 seed rows) — **NOT applied to any database.** Adi applies
by standard policy: backup at /admin/backup, verify printed host is
`ktcaaasmrryoxinsutzt`, `prisma db execute --file ...`, then
`prisma migrate resolve --applied 20260907000000_role_permissions`. The app
runs fine BEFORE the DDL (missing table = defaults only) and after it.
Until the DDL lands, the /buku/izin screen errors on save — expected.

## What landed in the 2026-09-07 session

Three changes, committed on `sept` as a3fa65c, 0532fef and b3bd57d. All
verified: lint clean, `npm test` 373 passed + 1 skipped / 35 files,
`npm run build` succeeds, and both forms checked in the browser on the dev
account. Not merged and not pushed — Adi does both.

1. **Privileged-role guards** in `app/actions/admin/staff.ts`. Only a real
   OWNER may grant or revoke OWNER or DEVELOPER, in both directions
   (`assertMayChangePrivilegedRole`); nobody may change their own role or
   deactivate their own account (`assertNotSelfLockout`); deactivating an
   OWNER or DEVELOPER needs a real OWNER. The point is that `requireOwner()`
   admits a DEVELOPER, so these compare the actor's REAL role — do not
   refactor them into gate helpers. Also fixed a pre-existing bug: the role
   dropdown offered DEVELOPER, which `staffSchema` had never accepted, so
   editing the DEVELOPER staff row would have silently rewritten its role.
2. **Bulk pengeluaran rewritten** in `app/buku/pengeluaran/entry-form.tsx`.
   Only Tanggal and Akun kas are form-level now; kategori and nama moved into
   each line, so one shopping trip can span categories. No server or schema
   change — `pengeluaranSchema` was already per-record. Partial-failure
   behaviour is unchanged. Petunjuk steps updated to match.
3. **`color-scheme` declared** in `app/globals.css` (`light` on `:root`,
   `dark` on `.dark`). It had never been set, so the browser painted native
   controls light — the `<select>` popup came out black-on-grey over the dark
   app. Affects every native control app-wide: select popups, the date picker,
   number spinners, scrollbars.

Gotcha found while verifying: `npm run dev` served a stale CSS chunk left by an
earlier `npm run build`, so the globals.css edit appeared to do nothing.
`rm -rf .next` before starting the dev server after a build.

## Handed to zcode — role permission toggle

`docs/prompts/role-permissions-zcode.md` — the brief was executed on
`feat/role-permissions` (see the State header). Previously this feature had
never existed in this repo; today's 154 gate calls collapsed to seven shapes
and are all migrated.

## What landed in the 2026-09-06 session

1. **Laba Rugi buckets renamed** (fcc8586): HPP -> Pengeluaran Bahan Baku,
   Biaya Operasional -> Pengeluaran Operasional. All four layers — Prisma enum
   `BAHAN_BAKU|OPERASIONAL`, ledger prefixes `Expenses:BahanBaku:*` /
   `Expenses:Operasional:*`, identifiers, UI/exports/CALK/petunjuk.
2. **Database wiped and reloaded** through the renamed code. Zero rejections.
   `laporan-check.mts` before vs after is IDENTICAL line for line.
3. **Worktree + zcode merged and deleted** (d5c1760, 44448b8): Bawa Pulang
   pricing tab, "Menu Management" rename, an unapplied index proposal.

## Data currency — reloaded to 2026-09-05 (2026-09-06 session)

The database was rebuilt from `backup-2026-09-06.json` so it matches the old
production system through **5 September**. That backup was exported at 15:40
WIB on the 6th and holds no 6 September rows — no sales had been rung yet — so
`CUTOFF_DATE = "2026-09-06"` currently excludes nothing.

Now loaded: 855 transactions (12 Apr -> 5 Sep), 902 sessions, 1734 order items,
135 cash registers, 1016 journal entries, 139 ledger postings, 134 day-closes,
six accounting months (April-September, all open). Zero rejections.

**Regression gate passed:** `laporan-check.mts` for April-July is byte-identical
to the pre-reload baseline. The extra September data moved nothing.

The old system stays in use during the parallel run, so this WILL go stale.
Repeating it means a fresh backup, raising `CUTOFF_DATE`, extending
`LOAD_MONTHS`, then wipe + reload — the loader is a bulk `createMany` and
cannot top up an existing database.

Two things the reload does not supply, both known and neither a fault:
- The books after July. `warungbooks-events.json` covers April-July only, so
  September shows Rp 1.672.000 income and no expenses. Adi enters those in
  Warung Books on his own schedule — this is NOT an open task for Claude and
  does not need raising again.
- Attendance after 29 August. The old export has none either, so the gap is in
  the old system, not the migration.

The old menu was imported **as-is** (54 items, 11 categories), including the
"Bawa Pulang" category of 10 duplicate items Adi built in the old system. That
overlaps with the new Take_Away price-override tab, and the prices are not a
uniform discount (Sate Buntel 65.000 -> 37.000, but Tengkleng 30.000 -> 32.000),
so they look like different portions. Consolidating the two is a post-deploy
decision only Adi can make.

## Deploy checklist (Vercel) — set these before cutover

Required env vars, beyond the Supabase and database ones already in use:
- `NEXT_PUBLIC_APP_URL` — absolute origin, no trailing slash. The signup
  confirmation email builds its redirect from it; unset sends staff to
  "undefined/auth/confirm".
- `STAFF_INVITE_CODE` — long random string, DIFFERENT from the local one.
  `/auth/daftar` is invite-only and **fails closed**: unset means nobody can
  register. The owner copies the invite link (which carries the code) from
  `/admin/staff`. Rotate it if a link leaks.

SEVEN variables must be set in Vercel. Six are read at runtime (grepped
2026-09-07 across `app`, `lib`, `utils`, `components`, `hooks`, `proxy.ts`,
`next.config.ts`): the four above plus `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`.

The seventh is **`DIRECT_URL`, required at BUILD time only** — see the gotcha
below. Nothing at runtime reads it; `lib/prisma.ts` builds its pool from
`DATABASE_URL`. `DEV_SEED_PASSWORD` and `MIGRASI_DATABASE_URL` stay
scripts-only, and the `NEXT_PUBLIC_SUPABASE_ANON_KEY` sitting in `.env.local`
is dead. `.env.example` documents all of them.

**Do not assume the Supabase variables already in Vercel are correct.** The
project moved on 2026-09-02 from `oyvgyhuzvxepteldlghn` to
`ktcaaasmrryoxinsutzt`, and the auth users moved with it, so whatever Vercel
holds was set for the RETIRED project. `DATABASE_URL` must be the 6543 pooled
URL there; `lib/prisma.ts` is already correct for serverless (global singleton,
`max: 5`, `attachDatabasePool`).

## Unapplied DDL — the transaction indexes

`prisma/sql/2026-08-add-transaction-indexes.sql` is written, reviewed, and NOT
applied to any database. `transactions` carries no indexes at all while every
report filters and sorts on `paidAt`, and the FK columns used in those filters
are unindexed too. The file is five additive `CREATE INDEX IF NOT EXISTS`
statements already wrapped in `BEGIN; ... COMMIT;`.

At today's 855 transactions nothing feels slow, so this is a post-cutover job
rather than a pre-deploy one — but it is cheap, invisible, and easy to forget,
which is why it has its own section. Apply it by the standard policy: back up
at `/admin/backup`, `prisma db execute --file <path>`, then record it in
`_prisma_migrations`. **The file's own header names `oyvgyhuzvxepteldlghn` in
its warning line; that project is RETIRED.** The live one is
`ktcaaasmrryoxinsutzt` — verify the printed host before running.

## Supplier table — where inventory management starts

`Supplier` is a STANDALONE table: `id`, `name`, `phone`, `notes`, `isActive`,
and the two timestamps. It has no relation to any other model, and `supplierId`
appears nowhere in the schema or anywhere in the code. `/admin/suppliers` is a
complete CRUD screen — `app/actions/admin/suppliers.ts` gives get, add, update
and a soft delete that only flips `isActive` to false — and the table is
covered by both backup and restore. Nothing else reads any of it.

It is unwired **on purpose**, and `app/admin/(ops)/suppliers/page.tsx` carries a
comment saying so, so that audits stop re-flagging it as dead code. It was the
counterparty on the retired `IngredientPurchase` model; Adi decided on
2026-09-01 to keep the screen because this is the starting point for the
purchasing and inventory work planned after the first deploy. It sits under
Menu in the admin index rather than Keuangan, because it no longer touches the
ledger.

When that work starts, two constraints carry over. New models hang off
`Supplier.id`, and the pengeluaran already posted to `Expenses:BahanBaku:*` is
the existing money record — extend it, never build a second spend ledger beside
it, and read `project_expense_buckets.md` before touching the buckets. Per-item
ingredient recipes are NOT coming back; that design failed three times and the
whole COGS system was deleted in the Warung Books merge.

## ⚠ The database is PRODUCTION now — do not wipe it

Adi decided on 2026-09-06 that the **April-onward history STAYS**. kasir goes
live carrying the migrated books; there is NO cutover wipe and no Saldo Awal
restart. The 2026-09-05 permission to wipe this database is **revoked** — the
rows in it are the bookkeeping he intends to keep. `UAT-RUN.md` and the UAT
memory both used to say "wipe and re-seed before going live" and were corrected.

Accepted knowingly: the books diverge from Warung Books by a cumulative
Rp 73.993 on Neraca. Those are input differences (see `docs/migrasi-data.md`),
not code defects, and keeping the history makes them permanent.

## Next step

Adi does the merges. No work is in progress. Open threads, all his:

1. **Deploy `sept` to a staging subdomain, leaving `master` alone.** Adi decided
   on 2026-09-07 not to retire the old version until the new one is proven, so
   the first deploy is a SECOND Vercel project on the same repo with its
   Production Branch set to `sept` — not a merge into `master`. Making `sept`
   that project's production branch keeps the subdomain publicly reachable;
   a branch domain on the existing project would sit in Preview and Vercel's
   default Standard Protection would put a Vercel login wall in front of the
   staff. Full procedure below under "Parallel deploy".
2. Rebuild the six staff accounts (`Adi`, `Dina`, `Hartanto`, `Kasir`,
   `Manager`, `Yati` all have `supabaseUserId` null, so only `dev.*` can log
   in). This needs `STAFF_INVITE_CODE` set FIRST or the invite links refuse
   everyone.
3. Set the real online commission rates — still needed for future settlements,
   no longer tied to a wipe.
4. Lock April-July in `/buku/bulan` when ready (all six months are open).

Adi runs the old system in parallel for at least a week before cutover, so
these are not all due at once.

## Parallel deploy — `sept` on a staging subdomain

The goal is to run the new app beside the old one without touching `master`.
Everything below is Adi's to do: the git-guard hook refuses `git push` in this
repo, and the Vercel CLI is not installed on this machine.

1. Push the branch only: `git push -u origin sept`. `master` and `develop` stay
   where they are, so the current production deployment does not move.
2. Create a SECOND Vercel project against `useradiw/kasir`. In its Settings ->
   Git, set **Production Branch** to `sept`. This is what keeps the subdomain
   public — see the note in "Next step" about Standard Protection.
3. In the same Git settings, set the **Ignored Build Step** so the staging
   project ignores every other branch:
   `if [ "$VERCEL_GIT_COMMIT_REF" = "sept" ]; then exit 1; else exit 0; fi`.
   Exit 1 BUILDS and exit 0 SKIPS — the codes read backwards, which is correct.
4. Add the subdomain under Settings -> Domains, connected to **Production**.
5. Set all seven env vars in that project's Production scope, per the deploy
   checklist above — `DIRECT_URL` included, or the build dies in
   `prisma generate`. Two of them must DIFFER from the eventual live values:
   `NEXT_PUBLIC_APP_URL` is the staging origin, and `STAFF_INVITE_CODE` is its
   own random string so a staging invite link never opens the real site.
6. In Supabase (`ktcaaasmrryoxinsutzt`) -> Authentication -> URL Configuration,
   add the staging origin to **Redirect URLs**. Without it `emailRedirectTo`
   falls back to the Site URL and confirmation links land on the wrong host.

**The staging site writes to the real books.** There is no second database, so
every test sale, pengeluaran and day-close on that subdomain becomes a real row
in the production ledger. Correct test entries by VOIDING them — the ledger is
append-only — and do not lock a month while testing is still running.

## Gotchas that bite

- **Never `prisma migrate deploy` or `db push`.** Apply DDL as a reviewed
  `BEGIN;...COMMIT;` file via `prisma db execute`, then `migrate resolve --applied`.
  `wipe-db.ts` is data-only and delivers NO DDL — an enum change still needs an
  ALTER even if you are wiping.
- **Bulk loads need port 5432** (`DIRECT_URL`). The 6543 pooler breaks the
  repositories' interactive transactions.
- **`DIRECT_URL` is required for EVERY Prisma CLI command, `generate`
  included** — so a deploy without it fails. `prisma.config.ts` sets
  `datasource.url` to `env("DIRECT_URL")`, and that `env()` helper throws
  `PrismaConfigEnvError` while the config module is still loading, before the
  command runs and regardless of whether it needs a datasource. `npm run build`
  starts with `prisma generate`, so the Vercel build dies there. Confirmed on
  2026-09-07 by a real failed Vercel build, reproduced locally with
  `DIRECT_URL= npx prisma generate`. Reading `schema.prisma` alone will NOT
  reveal this: its datasource block has no `directUrl` and mentions only
  `DATABASE_URL`. Empty counts as missing — `env()` rejects `!value`.
- **Stop the dev server** before `prisma generate` / `next build`, or the client
  half-writes and the pglite suite OOMs looking like a code bug.
- Plain `npx tsc` OOMs. Use
  `node --max-old-space-size=8192 node_modules/typescript/lib/tsc.js --noEmit`.
- **Adi can log the dev account in** for browser verification of owner-gated
  routes — ask instead of declaring something unverifiable.
- Judge console cleanliness in a **fresh tab**; a retained tab replays stale
  errors (and stale HMR sockets after a server restart).
- Any column of figures on screen must add up to the total shown against it.
  That has been a real bug three times.
- Correct mistakes by **voiding**; the ledger is append-only.
- `test/env-guard.ts` stops tests reaching the real database. Never remove it.
- Two migration inputs keep Warung Books' OWN spelling on purpose and must not
  be renamed: `warungbooks-events.json` (`"HPP"|"OpEx"`, mapped in `loader.ts`)
  and `warungbooks-reports.json` (`"Total HPP"`, the comparison key).

## Money-path change to remember

`calcItemPrice` no longer hardcodes the three online vendors — it applies
whatever per-service override matches, including `Take_Away`. A stray
`Take_Away`/`Unknown` price row now moves checkout totals where it used to be
discarded. Guarded in `test/kasir-utils.test.ts`.
