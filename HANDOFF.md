# HANDOFF

## 2026-09-01 (later) — login brute-force lockout, UNCOMMITTED
Section 2 of `plan-open-items.md`, built as specced. Six files, nothing else:
NEW `lib/login-throttle.ts` (injectable `db` + injectable clock, no
`"use server"`), NEW `test/login-throttle.test.ts` (9 tests, pglite, fake
clock), NEW `prisma/sql/2026-09-login-attempts.sql` (BEGIN;/COMMIT;-wrapped)
and its unwrapped twin `prisma/migrations/20260901000000_login_attempts/
migration.sql` (exists so `migrate resolve --applied` has a target — never run
`migrate deploy`). EDITED `app/actions/login.ts` and `prisma/schema.prisma`.
Rule: 5 consecutive failures lock the USERNAME STRING for 15 minutes; an
unknown username locks identically to a real one, which is what keeps the
account-enumeration leak closed (guard test 8 fails if anyone breaks that
symmetry). `checkLock` gates before the Staff lookup, `clearFailures` runs
after sign-in succeeds and BEFORE the `isActive` check — do not reorder
`isActive`, it is deliberately after password verification.
**NOT APPLIED to prod.** Adi runs `db execute` + `migrate resolve` himself,
after a backup. Claude ran no command that connects to a database.
lint clean, `npm test` 304 passed + 1 skipped. **`npm run build` FAILS** on
`app/kas/page.tsx:63` — `getCashRegisterDataForStaff` rows lack `createdAt`,
which `RegisterRowBase` in `components/kas/kas-shared.tsx:45` requires. That is
the parallel /kas Phase 3 work, not this diff.
The lockout has NEVER been exercised against a real sign-in — no OWNER login.


## 2026-09-01 — /kas Phase 3 built (UNCOMMITTED, on top of step 5)
`/kas` is now the real screen. `components/kas/{kas-shared,kas-owner,kas-cashier}.tsx`
render all five screens of `screens-kas.html`; screens 2, 4 and 5 (tutup kas,
detail hari, buka kas) are in-page client states, not routes, because the page
already holds their data. `app/kas/page.tsx` is still the only fetcher and
still calls `getCashRegisterData` / `getCashRegisterDataForStaff`.

**Adi approved all eight mockup additions**, so this slice DID add data (the
plan's "no new query functions" rule was lifted by that decision, once):
`getNonSalesCashMovementLines` in `lib/ledger-queries.ts` is now the primitive
and `getNonSalesCashMovementByDate` reduces over it — one filter, one source of
truth, guarded by a test that the lines sum exactly to the net. `sumDaySales`
gained `cashTxnCount`. `resolveRegisterPostings` in `queries/_shared.ts` is the
single posting/journal-number lookup both fetchers use. Both fetchers now also
return `qrisIncome`, `movements`, `cashAccountLabel`.

**There is no shift concept in the schema.** `CashRegister` is one row per date,
so wherever the mockup writes "Shift Siang" the screen shows the date and the
opener's name. Real shifts are a schema change and their own session.

**Deleted:** `app/cashregister/` and `app/admin/cash-register/`. `lib/revalidate.ts`
now points at `/kas` (it was NOT left empty — an empty revalidate is the silent
stale-numbers bug the plan warns about). `app/petunjuk/page.tsx` and
`validasi-tab.tsx:59` repointed at `/kas`.

lint, tsc and build clean; `npm test` 304 passed + 1 skipped (up from 289).
**Nothing has rendered against real data** — no OWNER or CASHIER login exists
for Claude, so open, close, edit, delete, the lock countdown, the recovery
button and the CSV download have never executed. UAT material.

**Next:** steps 6-8 — jurnal, kas (`/buku/kas`), laporan. Then the deletion commit.

## 2026-09-02 — three commits landed; a BLANK DB is coming

`docs/redesign/plan-open-items.md` is the plan of record. Committed on
`feat/warungbooks`, in this order:
- `aed6554` login brute-force lockout (per-username, 5 tries / 15 min).
- `8577ed5` the real `/kas` screen; `/cashregister` and `/admin/cash-register`
  DELETED. `reconcileCashDates` was extended, not duplicated.
- `35deeae` `/buku/pengeluaran`, `belanja`, `jurnal`, `kas`, `laporan`, plus the
  active-month setter on `/buku/bulan`.
Gates at that point: tsc, lint, build clean; 328 tests pass + 1 skipped.
NOTHING has been visually verified — Claude has no login.

**⛔ BEFORE DEPLOYING `aed6554`:** `checkLock` does not swallow errors, so the
code fails EVERY login until `login_attempts` exists. Apply
`prisma/sql/2026-09-login-attempts.sql` via `prisma db execute`, then
`prisma migrate resolve --applied 20260901000000_login_attempts`.

**Authorised 2026-09-01:** `/buku/belanja` is `requireAuth()`, not
`requireOwner()` — the only page under `/buku` that is. Do not "fix" it.

**⚠ NEXT, and it changes everything below:** Adi is repointing `DATABASE_URL`
to a NEW BLANK database so the app starts clean. When that lands, the whole
"migration history is incomplete" landmine goes away, and the job becomes:
reconcile the migration chain so `migrate deploy` from zero reproduces
`schema.prisma` exactly, then drop the dormant junk models. KEEP `Supplier`
(Adi's decision, reserved for future purchasing work). Open question Adi must
answer first: is the blank DB in the SAME Supabase project (so `Staff.supabaseUserId`
still resolves and everyone can still log in) or a new one (every staff account
must be recreated)?

**Section 7 (historical data migration) is still NOT approved** and now needs
rewriting for the blank DB: with nothing carried over, menu, staff and settings
must be imported too, not just the ledger. Warung Books stays the source of
truth for April-July 2026. A peer session named "Seed warungbooks/report to
kasir DB" may hold prior work — check it before replanning.

**Remaining plan work:** section 4 (retire `app/admin/page.tsx` and
`/admin/settlement`, make `/admin` the grouped index) and the deletion of
`app/admin/keuangan/` now that `/buku` covers it.

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
