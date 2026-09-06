# HANDOFF

## 2026-09-06 (later) — WORKTREE MERGED, BRANCHES CLEANED

The parallel `kasir-wt-menu-management` worktree and the `zcode` branch are both
folded into `feat/warungbooks` and deleted. Branches are now exactly
`master` -> `develop` -> `june` -> `feat/warungbooks`, and `git worktree list`
shows only the main checkout. Adi merges warungbooks -> june -> develop himself.

**What came from the worktree** (10 files, uncommitted there; committed as
747aad0 then merged as d5c1760): a Bawa Pulang pricing tab. The online-pricing
block was EXTRACTED into a shared `ServicePricingCard` that both tabs render,
so they cannot drift. `Take_Away` joined `onlinePriceSchema` — no migration
needed, it was already a `ServiceEnum` value and `MenuItemOnlinePrice.service`
uses that enum. "Inventori Menu" became "Menu Management" everywhere including
the petunjuk permission table. `SERVICE_LABELS` keeps the raw `Take_Away` off
the screen.

**A money-path behaviour change rode along, deliberately.** `calcItemPrice` no
longer hardcodes the three online vendors; it applies whatever override matches
the session's service. The old test asserting a `Take_Away` row must be IGNORED
was inverted on purpose and a fallback test added beside it. Consequence worth
remembering: a stray `Take_Away` or `Unknown` price row now moves checkout
totals where it used to be silently discarded.

**What came from zcode** (cherry-picked as 44448b8): one file,
`prisma/sql/2026-08-add-transaction-indexes.sql` — an UNAPPLIED additive
proposal, `CREATE INDEX IF NOT EXISTS` only. zcode had no other change against
its merge-base. It was force-deleted because a cherry-pick gives a new SHA, so
`git branch -d` could not see it as merged; the file was diffed against zcode's
copy first to prove the content landed.

**Two stale references the merge exposed, both fixed in 187b544:** CLAUDE.md
still called the bucket `Expenses:HPP:*`, and the index proposal told the reader
to verify the host is `oyvgyhuzvxepteldlghn` — the RETIRED project. Following
that literally would send someone hunting for a database that no longer exists.

**Verified after the merge:** lint clean, tsc clean, 373 passed + 1 skipped
across 35 files (up one — the new fallback test). Seen rendered: the Bawa Pulang
tab, the Harga Online tab unchanged after the extraction, and April's Laba Rugi
still reporting the same figures. Console clean in a FRESH tab (the retained tab
showed only stale HMR socket errors from the server restart).

## 2026-09-06 — BUCKET RENAME + DATABASE RELOAD (done, NOT committed)

Renamed both Laba Rugi buckets across all four layers, then wiped and reloaded
the database through the renamed code.

    HPP               -> Pengeluaran Bahan Baku
    Biaya Operasional -> Pengeluaran Operasional

**Identifiers.** `ExpenseBucket` enum `HPP|OPEX` -> `BAHAN_BAKU|OPERASIONAL`;
`ExpenseBucketKey` likewise; ledger prefixes `Expenses:HPP:*` ->
`Expenses:BahanBaku:*` and `Expenses:OpEx:*` -> `Expenses:Operasional:*`;
`labaRugi.hpp`/`.biaya_operasional` -> `.pengeluaran_bahan_baku`/
`.pengeluaran_operasional`; `getLedgerExpenseTotals` returns
`bahanBaku`/`operasional`; report-queries' summary fields
`cogs`/`grossProfit`/`grossMarginPct` -> `bahanBaku`/`labaKotor`/`labaKotorPct`;
seeded accounts `hpp-bahan` -> `bahan-baku` and `opex-komisi-online` ->
`operasional-komisi-online`. `bucketPrefix()` kept its name — it was already
bucket-neutral; only its return values changed.

**`Transaction.cogs` (the per-sale column) is untouched** and is a DIFFERENT
thing from the renamed summary field. The retired per-item COGS docs
(`docs/cogs-feature.md`, `docs/cogs-redesign-plan.md`, README line 69) describe
that dead design and were deliberately left alone.

**The "everything that is not HPP" rule is preserved exactly.**
`incomeStatement.ts` still walks every `Expenses:*` account and skips only the
bahan-baku prefix, so `Expenses:SelisihKas`, `KasKeluar` and `Diskon` keep
landing in the operational bucket. Only the prefix string changed; the
why-comment was rewritten, not dropped. Its two guard tests in
`test/statements.test.ts` caught a missed rename during this session, which is
exactly what they exist for.

**Two external inputs were NOT renamed, on purpose.**
`scripts/migrasi/warungbooks-events.json` keeps Warung Books' own `"HPP"|"OpEx"`
bucket spelling and is mapped at the seam in `loader.ts:215`.
`warungbooks-reports.json` keeps its `"Total HPP"` row label, so
`laporan-check.mts` still looks it up by that key while printing and comparing
the renamed kasir field. Renaming either would have broken the comparison that
proves the rename moved no number.

**Schema.** `prisma/migrations/20260906000000_rename_expense_bucket/` holds two
`ALTER TYPE ... RENAME VALUE` statements. Applied to the live database with
`prisma db execute` on a `BEGIN;...COMMIT;`-wrapped copy, then
`prisma migrate resolve --applied`. `prisma migrate status` now reports the
schema up to date. A rename relabels the enum member only — it rewrites no row
and touches no money column. `wipe-db.ts` is data-only and never delivers DDL,
which is why the ALTER was still required despite the wipe.

**Database wiped and reloaded.** Project `ktcaaasmrryoxinsutzt`, confirmed by
both the env check and wipe-db's own guard. 7881 rows deleted (the 5 `dev.*`
staff preserved), then reloaded with `run.mts --yes` and
`MIGRASI_DATABASE_URL` set to `DIRECT_URL` on **5432** — the 6543 pooler breaks
the repositories' interactive transactions. **Zero rejections**, same counts as
the previous load: 823 transactions, 1675 order items, 778 pengeluaran, 97
transfers, 2 modal, 130 tutup kas, 5 settlements (the 29 Aug GoFood one with its
Rp 211 adjustment).

**Verified — the rename moved no number.** `laporan-check.mts` was captured
before the first edit and again after the reload. Diffed with only the two
renamed row labels normalised: **identical, line for line**. Neraca balances and
Validasi passes 12/12 in all four months; April-July's remaining gaps are the
same input differences documented below, unchanged to the rupiah.

Post-reload database state: 688 `Expenses:BahanBaku` journal lines, 95
`Expenses:Operasional`, **0 stale old-prefix lines**, 42 categories in
`BAHAN_BAKU` and 25 in `OPERASIONAL`. Note the live data contains no
`Expenses:SelisihKas` lines, so the not-bahan-baku rule is exercised by the unit
tests rather than by this dataset. `ledger_accounts` holds only the 3 cash
accounts, same as before the wipe — the structural chart of accounts is seeded
from the UI, and will create the new `bahan-baku` /
`operasional-komisi-online` codes when Adi runs it.

**Also verified:** lint clean, tsc clean (raised heap), `npx vitest run` 372
passed + 1 skipped across 35 files — the same count as the last known green.
The pglite suite replays every migration folder, so it proved the new enum DDL
too. NOT seen rendered — the buku routes are owner-gated and Claude has no
login.

**Dev server was stopped** (it was running on port 4000) so `prisma generate`
would not half-write the client. Restart it with `npm run dev`.

**Seen rendered and verified in the browser (Adi logged the dev account in).**
Laba Rugi April shows both new headings with every figure matching the baseline,
and BOTH columns add up to their own totals (34 bahan baku rows = 6.408.500;
14 operasional rows = 7.812.900) — the column-adds-up rule that has broken three
times here. CALK, petunjuk, `/buku`, `/buku/kategori` and `/admin/reports` all
render the new terms with no old ones. Validasi 12/12 in the UI. No console
errors on any screen.

Exports were verified by capturing the REAL generated Blob in the page, not by
trusting the unit tests: the CSV carries `Total Pengeluaran Bahan Baku,6408500`
and `Total Pengeluaran Operasional,7812900`, and the 14.8 KB XLSX (6 sheets)
carries `PENGELUARAN BAHAN BAKU` / `PENGELUARAN OPERASIONAL` with no old terms.

`/admin/reports` Tahunan 2026 gives an independent cross-check: Pengeluaran
Bahan Baku Rp 26.421.000 is exactly April+May+June+July (6.408.500 + 7.008.000
+ 5.968.500 + 7.036.000), and Laba Kotor 14.499.395 at 35.4% reconciles.

**One regression found and fixed by looking.** `/buku/pengeluaran`'s kategori
dropdown rendered the raw enum, so it read `Arang (BAHAN_BAKU)` — the old
`(HPP)`/`(OPEX)` had read acceptably, but the underscore leaked a database
identifier into the UI. `entry-form.tsx` now maps it to `(Bahan Baku)` /
`(Operasional)`. Grepped for the same pattern elsewhere: this was the only one.

**NEXT:** say the word to commit. Nothing is committed.

**Note on branch:** something switched the checkout to `zcode` early in the
session; it was moved back to `feat/warungbooks` at `c59bc02` (which is
`fedfa91` amended). All work above is on `feat/warungbooks`.

## 2026-09-04 (later) — LINK + BUTTON AUDIT

Swept every link and button in `app/` and `components/`. Two classes of fix, both
uncommitted and stacked on top of the migration work below.

**Broken hrefs (10).** Nine links still pointed at `/admin/keuangan/*`, a route tree
the Warung Books merge deleted; all nine now point at their `/buku/*` equivalent
(`app/buku/page.tsx` quick actions, five links in `app/petunjuk/page.tsx`, and
`components/kas/kas-owner.tsx`). The tenth, in `components/kas/kas-cashier.tsx`, was
DELETED rather than repointed: `/buku/kas` is `requireOwner()`-gated and that
component only renders for a CASHIER, so repointing would have swapped a 404 for a
permission error. A why-comment there records this. `/tmp/href.py` validates every
literal href against the route table and now reports 0 broken.

**cursor-pointer.** Tailwind v4 dropped the preflight rule, and the project had it in
only 8 places, so nearly every control showed an arrow. Added once to the
`buttonVariants` base in `components/ui/button.tsx` (covers all 221 `<Button>` uses),
then explicitly to 58 `<Link>`, 43 raw `<button>`, and the shared class constants in
`components/shell/sheet.tsx` and `components/shell/ui.tsx`. Left alone on purpose:
`components/shared/badge.tsx` (already conditional on `onClick`), `app/global-error.tsx`
(inline styles by design), and six `<div onClick>` handlers that are
`stopPropagation` guards or a dismiss overlay, not affordances.

Also removed 5 duplicate anchor ids in `app/petunjuk/page.tsx` — the id now lives only
on `SectionHeading`, which carries `scroll-mt-28`, matching the other 7 sections.

**Verified:** lint clean, tsc clean, all 12 petunjuk anchors resolve, 0 broken hrefs.
The login screen was checked in the browser (both controls report `cursor: pointer`);
everything past it is behind auth on the live database, so it was verified statically
instead. `npx vitest run` OOMs right now — that is the documented dev-server trap
below, confirmed pre-existing by re-running on a stashed clean tree.

**Reachability (found by Adi, 2026-09-05).** The href audit checked only the
outbound direction. The inverse was broken: the whole Buku settings tier
(`/buku/bulan`, `/buku/akun`, `/buku/akun-penjualan`, `/buku/kategori`,
`/buku/setup`) was reachable ONLY from the setup checklist and from empty-state
alerts, which stop rendering once the shop is correctly configured —
`/buku/kategori` had no inbound link at all. `/buku` now carries an
unconditional "Pengaturan" group linking all five.
`test/route-reachability.test.ts` guards it, and was confirmed to FAIL when the
group is removed. Three routes stay link-free on purpose and are documented in
its `NO_LINK_EXPECTED`.

**Verified:** lint clean, tsc clean, `npx vitest run` 345 passed + 1 skipped
across 33 files. The `/buku` group itself was NOT seen rendered — those routes
are `requireOwner()`-gated and Claude has no login; they return 307 to the login
screen, which proves they compile, not that they look right. Adi should eyeball
the new group.

**Multi-month CSV export (2026-09-05).** `/buku/laporan`'s Unduh button is now
a month menu: it exports ANY accounting month without touching the `wb_month`
cookie. The month on screen is written from props with no round trip; the rest
go through `getLaporanKeuangan(month)` one at a time, with a per-row busy state
and `notify.error` on failure. `formatMonth` was extracted to `lib/format.ts`
(it was about to become a third copy) and is covered in `test/format.test.ts`;
`laporan/page.tsx` and `bulan/bulan-client.tsx` now import it. NOT seen
rendered — owner-gated, no login; routes compile and 307 with no server errors.

**Period selector + XLSX export (2026-09-05).** `/buku/laporan` now reports a
MONTH or a WHOLE YEAR, and exports the Warung Books workbook.

- `lib/laporan-period.ts`: period keys are self-describing — "2026-04" is a
  month, "2026" a year — which is why `buildLaporanKeuangan(period)` kept its
  one-string signature and NO existing caller or test changed. The statement
  engine already worked from dateFrom/dateTo, so yearly needed no engine work;
  Neraca is right for free because balanceSheet() snapshots at dateTo.
- The period lives in the URL (`?periode=`), NOT the `wb_month` cookie — Adi
  chose this so browsing laporan cannot silently retarget jurnal/kas/pengeluaran.
  The cookie is still the default when no query string is present.
- `CalkNotesRepository.listForMonth` -> `listForPeriod` (one call site). The
  stored key format is unchanged, so existing monthly notes still resolve.
- `lib/laporan-xlsx.ts` is a PURE spec carrying the Warung Books styling read
  off the real file; `lib/export-xlsx.ts` renders it (exceljs, dynamically
  imported like jsPDF). `applyWorkbook` is deliberately browser-free so
  `scripts/check-xlsx.mts` can render a real .xlsx in node.
- **Verified against the original**, not just unit-tested: a generated workbook
  was diffed cell-by-cell with openpyxl against
  "D:/Laporan Warung Sate Kambing/Laporan Keuangan April 2026.xlsx" — title
  font/size/#1F4E78, subtitle/business #666666, section fill #D9E1F2, the
  three-space indent, bold totals, column widths 46/20 and the Rupiah
  accounting number format ALL match. kasir adds a 6th sheet, CALK, on purpose.
- **Warung Books exports XLSX only.** The "Laporan Bulanan *.pdf" files in that
  folder carry `Producer: jsPDF 4.2.1` — they are kasir's OWN /admin/reports
  output. No PDF was added here; Adi chose XLSX-only.

Suite: 372 passed + 1 skipped across 35 files. Routes compile (307, no server
errors) for ?periode= month, year, absent and garbage. NOT seen rendered —
owner-gated, no login.

**Period selector redesigned after a UI audit (2026-09-05).** Adi rejected the
first attempt: it stacked a scale switch, a period chip strip and a download row
above the statement tabs — three rows of chrome before any number. The mockup
(docs/redesign/screens-laporan.html) had always said the period belongs in the
TOPBAR with the download as an icon beside it.

Rebuilt as `period-picker.tsx` (trigger + the app's existing Dialog),
`unduh-menu.tsx` and `laporan-actions.tsx`, all mounted in the page header;
`laporan-client.tsx` is now just the six tabs.

Audit findings, all measured not guessed (skill lives at
`C:\Users\62852\.agents\skills\ui-ux-designer` and is NOT registered with
Claude Code — read the path directly to use it):
- CRITICAL: dimming no-data months with opacity-50 gave 2.38:1 contrast
  (`--muted-foreground` on `--popover`), against a 4.5 floor. Now full-opacity
  muted (5.37:1) plus a dot marker. **Never dim by opacity in this palette.**
- CRITICAL: `prefers-reduced-motion` was handled NOWHERE in the app. Added to
  globals.css, using near-zero durations rather than `animation:none` because
  base-ui waits for animationend before unmounting a dialog.
- Reused `Dialog` instead of a hand-rolled sheet: Escape, focus trap,
  aria-modal and focus-return come free.
- 44px cells, aria-pressed + Indonesian aria-labels, pending state on the
  pressed cell (navigation runs in useTransition), radius vocabulary cut to
  three values.
- ACCEPTED AS-IS: `--border` is 1.15:1 against `--popover`, under the 3:1 UI
  floor, and NO surface in this dark palette reaches 3:1. Legibility rests on
  text contrast (5.37-14.55:1), not on the boundary. Do not "fix" this by
  inventing colors — docs/design.md forbids hardcoded hex.

**Portaled dialogs rendered WHITE on the dark app — fixed (2026-09-05).**
Adi spotted the period picker was white. Root cause: `dark` was applied to a
wrapper `<div>` inside `<body>` (app-shell.tsx, page.tsx, error.tsx, ...), never
to `<html>`. base-ui's `Dialog.Portal` and Sonner both mount on `document.body`,
OUTSIDE those wrappers, so they resolved tokens from `:root` = the LIGHT palette
(`--popover: oklch(1 0 0)`, pure white).

This was PRE-EXISTING and hit every dialog in the app — confirm-dialog,
notifications, kas-owner — not just the new picker. `dark` now sits on `<html>`
in app/layout.tsx; the app is dark-only (no theme toggle exists anywhere), so it
is unconditional. The `dark` classes on the wrappers are now redundant but
harmless.

Proven in the browser, both directions: an element appended to document.body
resolves `--popover` to rgb(29,33,38) now; reproducing the old setup (dark on a
wrapper, not html) made the same element `lab(100 0 0)` — pure white.

**NEXT (agreed order):** 1. commit this audit. 2. Rename HPP -> "Pengeluaran
Bahan Baku" and Biaya Operasional -> "Pengeluaran Operasional" across UI, code,
the `ExpenseBucket` enum and the `Expenses:HPP:*` / `Expenses:OpEx:*` ledger
prefixes. 3. Wipe and reload the database. Adi confirmed 2026-09-05 that the DB
is NOT yet production and may be wiped, which removes the need for an
`ALTER TYPE` rename, a live prefix-rewrite, and the backup-translation shim.
**Do not wipe until Adi has downloaded and reviewed the April-July laporan CSVs**
— that migrated history is the only copy of the data being judged.

**Dev server note:** kasir runs on port 4000 on this machine. Ports 3000/3001
are the familytree project; 3456 is ceklis.

## 2026-09-04 — MIGRASI SELESAI DAN TERVERIFIKASI

**The migration has RUN against the live database `ktcaaasmrryoxinsutzt`.** It was
wiped (73 rows of settlement-test data; the 5 `dev.*` staff were preserved by
`scripts/wipe-db.ts`), then loaded via `npx tsx scripts/migrasi/run.mts --yes` with
`MIGRASI_DATABASE_URL` set to `DIRECT_URL` — the pooler on 6543 breaks the
repositories' interactive transactions, so use 5432 for any bulk load.

**Zero rejections.** Live counts: 823 transactions, 870 table sessions, 1675 order
items, 131 cash registers, 748 attendance, 11 staff (5 dev + 6 imported, all with
`supabaseUserId` nulled), 67 expense categories, 5 accounting months (UNLOCKED —
Adi locks them via the UI), 1012 journal entries (2 modal + 97 transfer + 778
pengeluaran + 130 tutup kas + 5 settlement) and 135 ledger postings (130 + 5).
The 29 Aug settlement carries its Rp 211 balancing deduction.

**Reports verified with `npx tsx scripts/migrasi/laporan-check.mts`** (read-only,
runs the app's own `buildLaporanKeuangan` against live data). Neraca balances and
Validasi passes 12/12 in all four months. **July matches Warung Books exactly on
every Laba Rugi line.** April and June match on HPP and Biaya Operasional; May
matches on HPP. Remaining gaps are input differences, NOT code defects:
- April −44.978 pendapatan: a Rp 45.000 Warung Books sale entry with no POS
  transaction behind it, less Rp 22 of Rp-1 test rings in the till.
- June −2.999: Rp 3.000 on 28 June, plus Rp 1.
- May −39.995 pendapatan and −13.979 opex: the small day gaps, plus online booked
  at kasir's settlement gross (243.230) vs Warung Books' 220.830, and komisi taken
  from the real payouts (82.387) vs Warung Books' hand-typed 96.366.
Cumulative Neraca divergence is Rp 73.993 and stops growing after June.

**NEXT:** Adi enters August's books by hand, reads `/buku/laporan`, and locks
April–July with the button. Nothing is committed — `git status` shows the new
`scripts/migrasi/`, `docs/migrasi-data.md`, the edited test and this file.

## Rencana



**Read `docs/migrasi-data.md` first.** It is the active plan and it supersedes
`docs/redesign/plan-open-items.md`, which is finished — all five of its sections
shipped, and the UAT passed all seven sections (see `UAT-RUN.md`).

The job: move kasir's operational history (2026-04-12 → 2026-08-31) and Warung
Books' April–July bookkeeping into the new Supabase project, then read April
through July in `/buku/laporan` against the four XLSX reports Adi already has.

**All ten decisions are locked** — see the plan's "Keputusan yang sudah dikunci".
The four that changed late: online revenue uses kasir's settlement flow (NOT
Warung Books' sale-date recognition); `staff.supabaseUserId` is nulled; the
29 Aug settlement gets a Rp 211 balancing deduction row; only April–July get read.
**No application code changes** — everything goes through existing repositories.

**Next step:** extract the loader out of `test/migrasi-warungbooks.test.ts` into a
module both a pglite dry run and a real-database run can call, then add the two
things the harness does not do yet: exclude Warung Books' five `KOMISI` pengeluaran
(778 imported, not 783) and post the five online settlements through
`SettlementPostingRepository`.

**Inputs, all gitignored:** `backup-2026-09-03.json` (old prod export, 31 tables,
834 transactions), `scripts/migrasi/warungbooks-events.json` (67 categories, 783
pengeluaran, 97 transfers, 2 modal), `scripts/migrasi/warungbooks-reports.json`
(the four XLSX reports, as the comparison baseline).

**Proven already:** a full dry run against pglite loaded every operational table
and all 882 books events through the real repositories with ZERO rejections, and
reproduced Warung Books' Total HPP and Total Biaya Operasional to the rupiah for
all four months. July sales matched exactly too.

## ☠ DATABASE — read before any DB command

- **The database is the Supabase project `ktcaaasmrryoxinsutzt`** (since
  2026-09-02). `.env` and `.env.local` point at it; the old
  `oyvgyhuzvxepteldlghn` lines are commented out in both. **The old
  migration-history landmine is GONE** — that chain described a database that no
  longer exists. `prisma/migrations/` now holds one init plus
  `20260903000000_journal_number_unique`.
- Treat it as PRODUCTION anyway. `prisma.config.ts` does `import "dotenv/config"`,
  so every bare `prisma` CLI command targets it. Verify the printed host each time.
- **NEVER `prisma db push`** — it silently drops columns to make the database match.
- **pglite (in-process, `npm test`) is the only dev database.** No local Postgres,
  no Docker, no `pg_dump` on this machine. `.env.claude.local` belongs to a
  DIFFERENT project — never point kasir's schema at it.
- Take a backup at `/admin/backup` before any DB work. `backup-*.json` is
  gitignored; it holds real transactions, staff and salaries.

## ☠ A test once hit production (2026-07-28)

Modules under `app/actions/**` close over the Prisma singleton, which reads
`DATABASE_URL`, and vitest auto-loads `.env`. A test imported one and ran real
SELECTs against production. **`test/env-guard.ts`** (a vitest `setupFile`) now
neutralizes those vars before any test module loads, and releases each file's
pglite instance so the suite stops OOMing. **Do not remove it to make a test
pass.** Query-layer functions take an injectable `db: PrismaClient = prisma` —
test the `lib/` function, never the `"use server"` wrapper.

## Rules that keep biting if forgotten

- Every export of a `"use server"` file is a **callable POST endpoint**. Pure logic
  lives in `lib/` (injectable `db`); `app/actions/admin/queries/*` are thin
  `requireOwner()` wrappers. Every such file needs `"use server"` on line 1 and only
  async exports, or `prisma`/`pg` leaks into the client bundle and the Turbopack
  build dies on `pg/lib/connection-parameters.js`.
- `app/actions/admin/queries.ts` is a SEPARATE compat re-export from
  `queries/index.ts`. Adding a query module means updating **both**.
- ⚠ `queries/_shared.ts` has no `"use server"` and must stay that way — adding it
  would silently turn `reconcileCashDates` into an unauthenticated endpoint.
- **Never import the `sequences` table from a backup.** That is what rewound the
  journal counter and produced two live entries numbered 9 (UAT, 2026-09-03).
  `journal_entries.number` is now UNIQUE in the database.
- Any column of figures on screen must add up to the total shown against it. That
  has been a real bug three times (laporan Gaji, Neraca Ekuitas, Laba Rugi).
- A retained React error boundary replays old errors forever — judge console
  cleanliness in a **fresh tab**, or you will chase a fixed bug.
- Correct mistakes by **voiding**; the ledger is append-only. Never delete journal rows.

## The money gate on the cashier sync (2026-08-31)

`pushTransaction` runs `requireAuth()` + `lib/kasir-payload.ts` (zod) +
`lib/kasir-money.ts`. Two rules keep it from eating real sales, both regression-tested
in `test/money-parity.test.ts`:
- **Cashier identity is NOT enforced.** An offline sale is often synced after a shift
  change by whoever is signed in; requiring a match stranded sales forever.
- **The subtotal-vs-items check only applies to a FRESH payment** (`origin: "payment"`),
  because `retryUnsyncedTransactions` re-reads the item list at retry time.
The sync path only retries and `console.error`s, so **any rejection is a silently lost
sale** — never tighten this gate without extending that suite.

## Environment traps

- `prisma generate` while the dev server runs half-writes the client, and the whole
  pglite suite then OOMs with "Fatal process out of memory" that looks like a code
  bug. Stop the server first.
- A stale `.next/types` from an old production build reports phantom tsc errors about
  deleted layouts; `rm -rf .next/types` clears it.
- Plain `npx tsc` OOMs here. Use
  `node --max-old-space-size=8192 node_modules/typescript/lib/tsc.js --noEmit`.

## Verify with

`npm run lint`, `npm test`, the tsc command above. Last known green: 337 passed +
1 skipped, lint and tsc clean (2026-09-03), plus the migration dry run.
