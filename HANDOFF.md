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
The plan has **6 slices (0-5)** plus a Cutover. **ALL SLICES DONE.** What remains
is the UAT (memory `project_warungbooks_uat.md`) and then the Cutover.

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

## Slice 3a — DONE, uncommitted (operational money flows post to the ledger)
Slice 3 was split into **3a (posting seams)** and **3b (retire the old expense
screens)** — the approved scope was two slices' worth, and 3b depends on 3a.

**Design decisions settled with Adi 2026-07-28 (all four, recorded so 3b/4 don't
re-litigate them):**
1. Tunai + QRIS sales post **ONE journal entry per closed day** at tutup kas, not
   per sale. The plan asked for both, which would have double-booked every sale.
   ~1 entry/day keeps Jurnal readable; kasir is offline-first so per-sale posting
   at sync would make ledger order nondeterministic on retry.
   ⚠ Known consequence: **a day that is never closed never reaches the ledger.**
2. **Online sales post ONLY at settlement**, net of commission — cash-basis. So
   `sumDaySales` MUST exclude online-service transactions or they double-book
   against `Income:Sales:Online`. This is the single most important money rule
   added in this slice.
3. Tutup kas expected-cash now reads the **LEDGER**, not the `Expense` table.
4. Deleting a pencairan **voids** its entry then deletes the row.

**Posting shapes (verified against the code, not just the spec):**
- Day close `sourceType:"shift-close"`, `sourceId: cashRegister.id`:
  `Dr <tunai akun> cashSales / Cr Income:Sales:Tunai`,
  `Dr <elektronik akun> qrisSales / Cr Income:Sales:QRIS`, plus a selisih pair —
  short → `Dr Expenses:SelisihKas / Cr <tunai akun>`, over → `Dr <tunai akun> /
  Cr Income:SelisihKas`. Worked example (cash 500k, qris 200k, expected 450k,
  counted 440k) nets the drawer to **+490.000** — correct.
  **All three zero → posts NOTHING and returns null** (not a ledger event).
- Settlement `sourceType:"settlement"`, `sourceId: settlement.id`:
  `Dr <online akun> finalAmount`, `Dr Expenses:OpEx:KomisiOnline (komisi +
  potongan)`, `Cr Income:Sales:Online totalGross`.

**New expected-cash formula** (in `reconcileCashDates`, shared by the admin and
cashier screens): `openingCash + cashSales + nonSalesCashMovement`, where the last
term is the SIGNED net ledger movement on the tunai kas account excluding
`sourceType='shift-close'` (POSTED+VOID both included — a void and its reversal
net to zero, per `loadBook`'s reasoning). Strictly better than the old
`− totalExpenses`: it also picks up transfer/modal INTO the drawer, which the old
formula ignored entirely. `totalExpenses` keeps its field name for existing
clients but is now `max(0, −nonSalesCashMovement)`.
- ☠ This also fixed a **pre-existing bug**: `cashregister.ts:171` totalled
  expenses as `amount * cost` (ignoring `ExpenseItem.lineTotal`) while
  `report-queries.ts` used `computeExpenseTotal` (which prefers `lineTotal`), so
  with decimal qty the two screens reported different expense totals for the same
  day. No reconciliation path multiplies `amount * cost` any more.

**Failure policy — deliberate and important:** a cashier closing the register is
NEVER blocked by an accounting-config problem. `closingCash` is written first;
the posting is attempted after. `ChannelAccountNotSetError` / `PeriodLockedError`
→ register stays closed, `{posted:false}`, day is flagged. Anything else
propagates (real bugs must not be swallowed). Recovery is the
**"Belum tercatat ke buku besar"** badge + owner-only **"Catat ke buku besar"**
button on `/admin/cash-register`, driven by `LedgerPosting` existence.
- No `Notification` row is created: `NotificationType` has no value that fits a
  ledger-posting failure, and reusing `"TEST"` (which the agent first did) would
  show the owner a TEST badge for a real problem. Adding e.g. `LEDGER_POST_FAILED`
  needs an additive `ALTER TYPE … ADD VALUE`; deferred, `console.warn` for now.

New: `lib/accounting/{salesChannelRepository,salesPostingRepository,
settlementPostingRepository}.ts`, `lib/day-close.ts` (pure `sumDaySales`),
`app/actions/admin/day-close-posting.ts`, `app/actions/admin/queries/
ledger-cash-queries.ts`, `app/admin/keuangan/akun-penjualan/` (+ nav entry),
tests `sales-posting`/`settlement-posting`/`sales-channel`/`day-close`.
Modified: `accountingRepository.ts` (+`voidEntryTx`, extracted from `voidEntry`
so voids can compose inside one outer tx — `voidEntry`'s external behaviour
unchanged), `chart-of-accounts.ts` (+`Expenses:OpEx:KomisiOnline`),
`cashregister.ts`, `admin/cash-register.ts` (close/edit/delete all wired),
`admin/transactions.ts` (voiding a sale reposts its day), `settlement.ts`,
`queries/_shared.ts` (+`qrisByDate`), `cash-register-queries.ts`, both query
barrels, `admin/layout.tsx`.

- Gates: `tsc` clean, `lint` clean, **`npm test` 86 passed + 1 skipped** (was 52;
  +25 engine, +9 day-close), `build` clean with `/admin/keuangan/akun-penjualan`
  in the route list and nothing lost.
- **LIVE PASS DONE** via a TEMPORARY `app/auth/dev-slice3/` route, since DELETED
  (`grep -rn dev-slice app/`). Verified: Akun Penjualan renders all three
  channels, "Belum lengkap:" narrows correctly as channels are set, saved values
  bind; cash-register shows the unposted badge + recovery button ONLY for a
  closed day with sales and no posting, no badge for a posted day, no badge for a
  zero-sales day, negative selisih renders `-Rp 15.000`. Zero console errors,
  zero hydration warnings.
- Fixed during my review, after the agents: dropped the `"TEST"` notification
  (above); and `hasPosting` now also counts "nothing to post" as posted, else a
  genuinely-zero day showed "Belum tercatat" forever with a button that could
  never change anything.
- **NOT verified and cannot be:** no guarded action has run for real. No journal
  entry has ever been written by a real tutup kas or pencairan. See the UAT memo.
- NOT committed. Next: Slice 3b.

## Slice 5 — DONE, uncommitted (Buku Kas + Cek Saldo + Tutup Buku) — LAST SLICE
Ported from tokokencana (`getBukuKas`/`getCekSaldo`, `lockMonth`/`unlockMonth`,
the `buku-kas` and `bulan` screens). The lock ENFORCEMENT already existed —
`assertNotLocked` runs inside `postEntryTx`/`voidEntryTx`, so `PeriodLockedError`
was live on every money path since Slice 0; this slice only adds the UI that sets
the lock, plus reconciliation. `BalanceAssertion` finally gets used (built Slice 0,
unused until now).

**☠ TWO BUGS CAUGHT — one in the donor, one in the new UI:**
1. **The donor's `getBukuKas` used `entry.lines.find(l => l.account === acc.name)`
   — ONE line per entry.** kasir's day-close entry puts TWO legs on the same kas
   account (Dr kas for sales, Cr kas for the selisih), so `.find()` would count
   only the sales leg: the running saldo would show gross sales and silently
   disagree with `saldoAkhir` (which sums all lines via `book.balance`). Now
   AGGREGATES every line on the account within an entry into one net movement.
   Invariant `saldoAwal + sum(masuk) - sum(keluar) === saldoAkhir` is tested,
   including the two-legs case specifically.
2. **Cek Saldo's badge had the selisih sign BACKWARDS.** `selisih = saldoLedger -
   saldoTercatat`, so POSITIVE means the buku besar exceeds the counted money —
   cash is MISSING. The badge said "Lebih" (surplus) for that case, i.e. it showed
   a shortage as extra money, which an owner would act on. Now "Uang kurang" /
   "Uang lebih" (spelled out, because a bare "Kurang" is still ambiguous about
   which side is short).

**Also fixed: the test suite was intermittently OOMing.** Each test file creates
its own in-process pglite (WASM) database and NOTHING released them — all 16
accumulated for the whole run and the suite began dying with "Array buffer
allocation failed" under memory pressure. `test/setup.ts` now tracks every client
and `test/env-guard.ts` registers an `afterAll` that disconnects Prisma AND closes
the pglite instance (`$disconnect` alone leaves the WASM heap allocated). Do not
remove it; a new test file needs no per-file teardown.

- `lockMonth({month, force})` runs `buildLaporanKeuangan(month)` first and REFUSES
  when `validasi.all_pass` is false, naming the failing checks in Indonesian.
  `force: true` is a separate deliberate second step in the UI, only offered after
  a plain lock has failed — never shown up front, never automatic.
  **No separate "unposted days" check was added on purpose:** the sales
  cross-check already fails when a day was never closed, so such a month refuses
  to lock by itself.
- Cek Saldo: recording a count writes a `BalanceAssertion` and does NOT touch the
  ledger — it is evidence of what was physically there. Never-counted accounts
  render "Belum pernah dihitung", never Rp 0 (null ≠ zero drift).
- Once assertions exist, `getLaporanKeuangan` feeds them to `runValidations` as
  `closingBalances`, so the Validasi tab's drift check goes live automatically.
- New: `lib/buku-kas.ts`, `app/actions/admin/queries/buku-kas-queries.ts`
  (`requireOwner()` wrappers over injectable-`db` lib functions — the Slice 4
  auth pattern), `recordBalanceAssertion`/`lockMonth`/`unlockMonth` in
  `app/actions/admin/keuangan.ts`, `app/admin/keuangan/{buku-kas,bulan}/`,
  tests `buku-kas`/`cek-saldo`/`month-lock`.
- Gates: `tsc` clean, `lint` clean, **`npm test` 130 passed + 1 skipped** (was 116;
  +14), `build` clean with both new routes.
- **LIVE PASS DONE** via a TEMPORARY `app/auth/dev-slice5/` route, since DELETED
  (`grep -rn dev-slice app/`). Verified: the day-close entry renders as ONE
  movement of 4.975.000 (the aggregation fix, visible on screen); running saldo
  2.000.000 − 500.000 + 4.975.000 = 6.475.000 = Saldo Akhir; zero amounts show
  "—" not "Rp 0"; a never-counted account reads "Belum pernah dihitung";
  locked/open months show the right actions; both empty states read calmly.
  Zero console errors, zero hydration warnings (fresh tab).
- **Could NOT be verified in the harness:** the force-lock path, because the
  "Kunci Paksa" button only appears after a real `lockMonth` call fails
  validation. Covered in the UAT.
- Petunjuk updated: Buku Kas, Cek Saldo, Tutup Buku, and the consequence below.

## ⚠ LOCKED MONTH vs TUTUP KAS — documented, by design
If a month is locked and a cashier then closes a register dated inside it, the
kas closes normally but the entry does NOT reach the buku besar — the day shows
"Belum tercatat ke buku besar" on Kas Harian, recoverable by the owner button
after unlocking. That is Slice 3a's non-blocking policy meeting Slice 5's lock;
it is correct, and it is written in the petunjuk so it is not read as a bug.

## Slice 4 — DONE (committed c3ac10c; Laporan Keuangan: 4 statements + CALK + validasi)
Mostly a PORT from tokokencana (`src/lib/queries/keuangan.ts`, `laporan-csv.ts`,
`app/admin/keuangan/laporan/`) — the statement engine itself arrived in Slice 0.

**☠ THREE REAL BUGS FOUND AND FIXED IN THE STATEMENT ENGINE.** All three were on
the money path, all three shipped in the donor, and two were invisible on screen:

1. **`incomeStatement` dropped expense accounts outside `Expenses:HPP:` /
   `Expenses:OpEx:`.** In kasir that is `Expenses:SelisihKas` — so every cash
   shortage at tutup kas was excluded from biaya operasional and **laba bersih
   was overstated by the full amount of every selisih**. Laba Rugi still "added
   up" on screen because the missing account was simply absent. It also
   disagreed with `/admin/reports`, which since Slice 3b counts all `Expenses:*`
   except HPP. Now biaya operasional = every expense account that is not HPP, so
   the two screens can no longer diverge. Non-category accounts get friendly
   labels via `NON_CATEGORY_LABELS` (`Selisih Kas`, `Kas Keluar`, `Diskon`).
2. **Validation check (3) was a TAUTOLOGY.** `npPeriod` was assigned
   `ls.laba_bersih`, so `"Laba Rugi: Laba Bersih = -(Income+Expenses)"` compared
   a value to itself and could never fail — which is exactly why it missed bug 1.
   `npPeriod` is now recomputed from the ledger as
   `-(balancePrefix("Income:") + balancePrefix("Expenses:"))`, i.e. what the
   check's own name always claimed. Bug 1 was caught only by check (4)
   (Perubahan Modal), which is genuinely independent.
3. **Neraca's Ekuitas column did not add up.** `balanceSheet` pushed the Prive
   line as `-prive` when `prive` was already equity-signed, so the column showed
   Modal + Saldo Awal + Prive + Saldo Laba = 9.275.000 against a correct total of
   7.275.000. Sign kept as-is; the invariant `sum(lines) === total` now holds.

How they were caught: the live pass drives the REAL engine from a fabricated
`Book` instead of a hand-written fixture, so the on-screen numbers are genuinely
computed. Four statements disagreeing by exactly 25.000 is what surfaced bug 1.
**Keep doing it that way** — a typed fixture would have agreed with itself.

**Security fix folded in (a hole I opened in Slice 3a):** every export of a
`"use server"` file is a callable POST endpoint, and `ledger-cash-queries.ts` +
`laporan-keuangan-queries.ts` had ZERO auth while every sibling query module had
some. `getLaporanKeuangan` returns the whole financial position. Fixed by moving
the pure bodies to `lib/ledger-queries.ts` + `lib/laporan-keuangan.ts` (taking an
injectable `db`) and keeping thin `requireOwner()`-gated wrappers under
`app/actions/`. `ledger-cash-queries.ts` is deleted and
`getNonSalesCashMovementByDate` is no longer barrel-exported — it never needed to
be an endpoint. **Audited: every remaining async export under
`app/actions/admin/queries/` now calls an auth guard.**
⚠ `queries/_shared.ts` has NO `"use server"` directive, so `reconcileCashDates`
is a plain helper, not an endpoint. If anyone ever adds that directive it
silently becomes an unauthenticated endpoint. Leave it alone.

New: `lib/laporan-keuangan.ts` (`buildLaporanKeuangan`, `toPlain`, the kasir
`getSaleTotals`), `lib/ledger-queries.ts`, `lib/calk.ts`, `lib/laporan-csv.ts`,
`lib/accounting/calkNotesRepository.ts`, `app/admin/keuangan/laporan/` (6 tabs),
`saveCalkNote`, tests `statements`/`laporan-keuangan` + `test/fixtures/`.
- **CALK** = generated figures + editable per-section notes, persisted in the
  existing `AccountingSetting` table as `calk:<month>:<sectionKey>` — no
  migration. Six SAK EMKM sections.
- **CSV** uses kasir's existing `exportCSV` (client-side, BOM already handled) —
  the donor's papaparse + API route were NOT ported; same format, no new dep.
- **The sales cross-check is the highest-value part.** It compares ledger
  `Income:Sales:*` against the `Transaction` table via `sumDaySales` (+ settlement
  gross for online). Because kasir posts sales once per CLOSED day, **a day that
  was never closed shows up here as a gap** — the only thing that surfaces the
  known weakness of the per-day design. The Validasi tab says so in Indonesian.
- Gates: `tsc` clean, `lint` clean, **`npm test` 116 passed + 1 skipped** (was 95;
  +16 pass-1, +5 regression tests I added for the three bugs), `build` clean with
  `/admin/keuangan/laporan` present.
- **LIVE PASS DONE** via a TEMPORARY `app/auth/dev-slice4/` route, since DELETED
  (`grep -rn dev-slice app/`). On a book with modal + saldo awal + tunai/QRIS/
  online sales + HPP + OpEx + selisih + prive: Laba Bersih 5.275.000, Neraca
  "Seimbang" at 7.275.000 both sides, Arus Kas kas awal 2.000.000 + kenaikan
  5.275.000 = 7.275.000, Perubahan Modal 7.275.000 — all four agree, every
  column adds up, all 10 validations OK. **Prive confirmed under PENDANAAN**, not
  operasi (the bug the UAT memo warns about). Zero console errors, zero hydration
  warnings (checked in a FRESH tab — a retained error boundary replays old errors
  forever and will mislead you).
- Empty-book state verified: a calm Indonesian notice pointing at the three setup
  steps rather than a wall of Rp 0.
- **NOT verified and cannot be:** no guarded action has run for real. Run the UAT.

## ☠ A TEST HIT PRODUCTION ON 2026-07-28 — read before writing any test
While building Slice 3b a subagent wrote a test that imported
`app/actions/admin/queries/ledger-cash-queries.ts` directly. Those modules close
over the module-level singleton in `lib/prisma.ts`, which builds a `pg` Pool from
`DATABASE_URL` **= PRODUCTION**, and vitest's config resolution auto-populates
`process.env` from `.env` regardless of the `NEXT_PUBLIC_` rule. Result: real
read-only `SELECT`s ran against the production database. **No writes occurred**,
and it was caught because the query returned zeros instead of throwing — which is
exactly what a passing test against an empty pglite DB looks like. It stayed
harmless by luck, not by design.

Guard added: **`test/env-guard.ts`**, wired as `setupFiles` in `vitest.config.ts`.
It rewrites `DATABASE_URL`/`DIRECT_URL`/`POSTGRES_*` to a closed local port before
any test module is imported, so anything reaching for a real server now fails
loudly. **Do not remove it to make a test pass.** When testing a query-layer
function, inject the pglite client — the ledger query helpers take an optional
`db: PrismaClient` third parameter for exactly this. Before that incident no test
had ever imported anything under `app/`, so there was no safe pattern to copy.

## Slice 3b — DONE, uncommitted (laporan on the ledger; flat money screens retired)
Sequenced as two passes because the deletions break the file the first pass edits.

**Design decisions settled with Adi 2026-07-28:**
1. Cashiers keep the **`/expenses` URL and its main-menu entry**, now rendering the
   WB pengeluaran Catat form. New `recordPengeluaranAsStaff` action is gated
   `requireAuth()` — the SAME audience `/expenses` always had. **This is an
   owner-approved permission change: any authenticated staff (incl. CASHIER) can
   now write a pengeluaran journal entry.** Catat only — no void, no edit, no
   kategori management. The action carries a "do NOT fix this back to
   requireOwner" comment.
2. Laporan's HPP comes from the ledger's `Expenses:HPP:*`.
3. **Gaji is no longer subtracted from laba bersih.** `netProfit = pendapatan −
   HPP − pengeluaran`, all from the ledger. `Staff.salary x hari hadir` stays
   visible as an ESTIMATE. Recording gaji as a pengeluaran is what makes it hit
   laba bersih — otherwise it would have been double-counted.
4. Kas Pak Har retired too (Adi chose this over deferring): the screen is gone and
   Pak Har money is a normal pengeluaran against the **Kas Pak Har** kas account.

**☠ REGRESSION FIXED HERE, introduced by Slice 1:** `report-queries.ts:304` summed
`Transaction.cogs` for `totalCogs`, but Slice 1 stopped writing that field (always
null). So `totalCogs` decayed to 0, `grossProfit` became equal to revenue, and
laporan showed a **100% gross margin** for everything after Slice 1 deployed. If
Slice 1 was live in production, laporan's margin was wrong for that window.

New: `getLedgerExpenseTotals` + `getLedgerPengeluaranForPeriod` in
`queries/ledger-cash-queries.ts` (HPP vs OpEx split; POSTED+VOID so voids net to
zero; hpp+opex == grand total of all `Expenses:*`, asserted in a test),
`app/admin/keuangan/_components/pengeluaran-form.tsx` (extracted so the owner page
and `/expenses` share ONE implementation — `DecimalInput` + `formKey` reset carried
across intact), `test/ledger-expense-totals.test.ts`, `test/env-guard.ts`.
Deleted: `/admin/expenses`, `/admin/expense-templates`, `/admin/kas-pak-har`,
`app/actions/{admin/expenses,expenses,admin/expense-templates,admin/kas-pak-har}.ts`,
`queries/expense-queries.ts`, `components/expenses/`, `lib/expense-schema.ts`,
`lib/expense-utils.ts`.
Dormant (byte-identical move, sorted-diff EMPTY, `prisma validate` passes):
`Expense`, `ExpenseItem`, `ExpenseTemplate`, `KasPakHar`, enum `KasPakHarType`.
Backup/restore still list all four tables — dormant data stays backed up.
Also: laporan's private third copy of the cash reconciliation is gone, replaced by
the shared `reconcileCashDates`, so all three screens finally agree.

- Gates: `tsc` clean, `lint` clean, **`npm test` 95 passed + 1 skipped**, `build`
  clean. `/expenses` present; `/admin/expenses`, `/admin/expense-templates`,
  `/admin/kas-pak-har` gone.
- **LIVE PASS DONE** via a TEMPORARY `app/auth/dev-slice3b/` route, since DELETED
  (`grep -rn dev-slice app/`). Verified: the Catat form shows Kas Pak Har as a kas
  account (the migration path), `0,5 x 150.000` auto-fills 75.000 and submits
  `qty: 0.5` dot-normalized, the post-save reset returns qty to `1`; laporan's
  Profitabilitas column now adds up top-to-bottom (12M − 4,5M − 2,6M = 4,9M);
  pengeluaran list reads from the buku besar with a VOID badge; petunjuk renders
  and explains where the Kas Pak Har screen went. Zero console errors, zero
  hydration warnings (confirmed in a FRESH tab — a retained error boundary replays
  old errors forever, which cost time to diagnose; use a new tab to judge console
  cleanliness).
- Fixed during my review, after the agents: **laporan's Gaji row showed
  `−Rp 4.200.000` inside the deduction chain while not actually being deducted**,
  so the column visibly failed to add up. Moved below Laba Bersih, no minus sign,
  labelled "Gaji (estimasi, di luar hitungan)". Also: the pengeluaran list showed
  raw `Assets:Cash:PakHar` and kategori CODES — now resolves `LedgerAccount.label`
  and `kategoriNama` (falling back to the code when a kategori was deleted).
- **NOT verified and cannot be:** no guarded action has run for real. Run the UAT.

## ⚠ CUTOVER CONSEQUENCE, now live
Laporan reads the LEDGER only. Pre-cutover pengeluaran that live in the old
`Expense` table **no longer appear in laporan** — the rows are intact and still in
backups, but they are invisible to the report. Re-enter what matters via
Saldo Awal / pengeluaran, or accept the gap. This is inherent to switching sources
and is why the plan wanted a cutover date.

## Slice 3a notes (committed 24ffb62) — laporan was left inconsistent ON PURPOSE, now resolved by 3b
`report-queries.ts` still reads the `Expense` table while tutup kas reads the
ledger. That was a deliberate scope line, but it means **laporan and kas harian
now disagree about expenses** until 3b switches laporan to the ledger. 3b scope:
cashier-accessible WB pengeluaran route (`/expenses` is `requireAuth()`,
`/admin/keuangan/pengeluaran` is `requireOwner()` — cashiers need a route),
delete `/expenses` + `/admin/expenses` + `/admin/expense-templates`, move
`Expense`/`ExpenseItem`/`ExpenseTemplate` into the DORMANT block, and repoint
`report-queries.ts` at the ledger.

## Slice 1 — DONE (committed e9e8ce4; code-only strip, tables dormant)
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
