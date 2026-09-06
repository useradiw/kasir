# HANDOFF

## State — 2026-09-06

`feat/warungbooks` at 95c1e3e, tree clean, one worktree, branches are exactly
`master` -> `develop` -> `june` -> `feat/warungbooks`. Nothing pushed.
**Adi merges warungbooks -> june -> develop himself.**

Last green: lint clean, tsc clean (raised heap), 373 passed + 1 skipped / 35 files.

## What landed this session

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

`.env.example` lists every variable the app reads. `prisma/sql/2026-08-add-
transaction-indexes.sql` is an UNAPPLIED additive index proposal — worth
applying once the shop is live, by the db execute + migrate resolve procedure.

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

1. Set `NEXT_PUBLIC_APP_URL` and `STAFF_INVITE_CODE` in Vercel, deploy, log in
   once on the deployed URL. Nothing here has ever run on Vercel.
2. Rebuild the six staff accounts (`Adi`, `Dina`, `Hartanto`, `Kasir`,
   `Manager`, `Yati` all have `supabaseUserId` null, so only `dev.*` can log
   in). This needs `STAFF_INVITE_CODE` set FIRST or the invite links refuse
   everyone.
3. Set the real online commission rates — still needed for future settlements,
   no longer tied to a wipe.
4. Lock April-July in `/buku/bulan` when ready (all six months are open).

Adi runs the old system in parallel for at least a week before cutover, so
these are not all due at once.

## Gotchas that bite

- **Never `prisma migrate deploy` or `db push`.** Apply DDL as a reviewed
  `BEGIN;...COMMIT;` file via `prisma db execute`, then `migrate resolve --applied`.
  `wipe-db.ts` is data-only and delivers NO DDL — an enum change still needs an
  ALTER even if you are wiping.
- **Bulk loads need port 5432** (`DIRECT_URL`). The 6543 pooler breaks the
  repositories' interactive transactions.
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
