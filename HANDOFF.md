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

## Next step

Adi does the merges. No work is in progress. If picking something up, the open
threads are: Adi enters August's books by hand, then locks April-July with the
button in `/buku/bulan`.

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
