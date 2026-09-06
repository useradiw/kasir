# UAT run log — Warung Books

Plan: `~/.claude/projects/D--Website-adi-kasir/memory/project_warungbooks_uat.md`
Run started 2026-09-03 on the blank database, signed in as `dev.developer`.
Dev server on http://localhost:3000.

Driving note: the browser `computer` click tool times out in this pane, so clicks
are dispatched as real DOM `.click()` calls. Same React handler, same server
action — the tests are still exercising the real UI.

## Setup — PASS
`/buku/setup` reads 4/4. `/buku/bulan` shows September 2026 active and open.
Journal baseline was 0 entries.

## Section 1 — pengeluaran and the entry forms — ALL PASS
- [x] Belanja with qty `0,5` x Rp 120.000 computed Rp 60.000. The Indonesian
      comma regression from 2026-07-28 holds.
- [x] Journal entry #1, "SEIMBANG", Dr Expenses:HPP:KULAKAN / Cr
      Assets:Cash:BankBCA, selisih 0.
- [x] Void produced reversing entry #2, marked #1 VOID, and removed #1's Void
      button so it cannot be double-voided.
- [x] Transfer BankBCA to KasLaci Rp 250.000 — entry #3, both legs, opposite
      signs, balanced.
- [x] Modal Rp 5.000.000 (#4), Prive Rp 300.000 (#5), Saldo Awal Rp 1.000.000 on
      Kas Pak Har (#6). Each balanced.
- [x] Journal numbers 1-6: gapless, ascending, no duplicates.
- [x] Same-account transfer refused: "Akun asal dan tujuan transfer tidak boleh
      sama."
- [x] Zero and negative amounts refused: "jumlah: Harus lebih dari 0".
- [x] Duplicate category code refused: "Kode kategori \"GAJI\" sudah dipakai."
- [x] Deleting a category used by a LIVE entry refused: "Kategori \"KULAKAN\"
      masih dipakai oleh transaksi pengeluaran — nonaktifkan saja."
      (An earlier attempt succeeded, correctly: the guard ignores VOID entries
      and the only KULAKAN entry had just been voided. Not a bug.)

## BUG FOUND — "Isi kategori default" lies
`ensureDefaultCategories` in `lib/accounting/expenseRepository.ts:227` returns
early when `expenseCategory.count() > 0`, so the button does nothing once even
one category exists — while still showing the toast "Kategori default
ditambahkan". The `createMany({ skipDuplicates: true })` on the next lines is
already the correct idempotent mechanism; the count guard makes it unreachable.
Effect: an owner who deletes a default category has no working way to restore
it, and is told the restore succeeded. Not a ledger-integrity problem.
Proposed fix: delete the `count() > 0` early return.

## Section 7 — login lockout — PASS
- [x] Five wrong passwords on `uji.lockout.zzz` gave "Username atau password
      salah."; the sixth gave "Terlalu banyak percobaan. Coba lagi dalam 15
      menit."
- [x] A real account (`dev.developer`) signed in normally while that fake
      username was locked.

## Section 4 — laporan — ALL PASS (one bug found and fixed)
Checked every column by hand against the seven entries posted in section 1.
- [x] Laba Rugi: 0 pendapatan - 1.500.000 HPP = -1.500.000 laba kotor and bersih.
      The voided Rp 60.000 is correctly excluded; modal, prive, transfer and
      saldo awal are correctly absent.
- [x] Neraca: Bank BCA 5.000.000 - 250.000 - 300.000 - 1.500.000 = 2.950.000.
      Total aset 4.200.000. Ekuitas 5.000.000 + 1.000.000 - 300.000 - 1.500.000
      = 4.200.000. Balanced, and every column adds to its printed total.
- [x] Arus Kas: Prive appears under PENDANAAN, not operasi. The tokokencana bug
      is not present. Pendanaan 5.700.000 - operasi 1.500.000 = 4.200.000 kas
      akhir, agreeing with Neraca. The internal transfer correctly does not
      appear.
- [x] Perubahan Modal: 1.000.000 + 5.000.000 - 1.500.000 - 300.000 = 4.200.000.
- [x] Validasi: 12/12 OK, every cross-check green.
- [x] CSV downloads and matches the screen number for number.

### BUG FOUND AND FIXED — CALK ekuitas column did not add up
`lib/calk.ts` built the Ekuitas section without its `Laba Bersih` row, so the
column read 1.000.000 + 5.000.000 - 300.000 = 5.700.000 while printing Modal
Akhir 4.200.000 against it. The Perubahan Modal tab and the CSV both had the row;
only the CALK omitted it, and `CalkInput` did not even declare `laba_bersih`.
This is the exact "every column must add up" rule that has now bitten four times.
Note that Validasi 12/12 does NOT cover it — no check reads the CALK.
Fixed, plus a guard test in `test/buku-laporan.test.ts`.

## Section 5 — buku kas and closing — ALL PASS
- [x] Buku Kas running balance verified step by step for Bank BCA, ending
      2.950.000; masuk 5.060.000 - keluar 2.110.000 = 2.950.000. Kas Laci
      250.000 and Kas Pak Har 1.000.000 both agree with Neraca.
- [x] Cek Saldo: counted Kas Laci at 200.000 against a book balance of 250.000
      and it reported "UANG KURANG RP 50.000". Sign and wording correct, and the
      ledger was not changed.
- [x] Tutup buku REFUSED while a validation failed, naming it ("Saldo kas sesuai
      assertion: Assets:Cash:KasLaci"), and Kunci Paksa appeared as a separate
      deliberate button.
- [x] Kunci Paksa locked the month.
- [x] A backdated entry into the locked month was REJECTED: "Bulan ini sudah
      ditutup — entri tanggal 2026-09-03 berada dalam periode terkunci (s/d
      2026-09-30)." Nothing was saved.
- [x] Buka Kembali unlocked it and the same entry then saved.
- [ ] Lock a month, then close a register dated inside it ("Belum tercatat ke
      buku besar"). Needs a register, so it belongs with section 3.

Cosmetic nit, not filed as a bug: the locked-month toast renders a double period
("mengubahnya.. Perbaiki"), from concatenating a message that already ends in one.

## Section 3 — operational postings — ALL PASS
Run through the real UI. Note the close variants that are only reachable once
per date (exact count, all-zero day, a second post) are covered at the engine
level in `test/sales-posting.test.ts`, not through the screen.
- [x] Tunai sale rung up in `/kasir`, register closed at `/kas`: ONE journal
      entry for the day, debiting the mapped kas account and crediting
      `Income:Sales:Tunai`.
- [x] Counted cash SHORT by Rp 10.000 posted `Dr Expenses:SelisihKas` — a
      shortage booked as an expense, the right direction.
- [x] Voiding the sale reversed and reposted: #10 VOID, #11 its reversal, #12
      fresh. Expected cash fell to 120.000 against 145.000 counted, so #12 read
      `Dr Assets:Cash:KasLaci 25.000 / Cr Income:SelisihKas 25.000` — an OVERAGE
      credited to income, the correct opposite sign, and no sales line.
      Exactly one live posting for the day.
- [x] **Online settlement posts net of commission and deductions.** A GoFood
      sale of Rp 70.000 paid Unsettled, then settled with the platform
      commission at 20% + Rp 1.000 (= Rp 15.000) plus a Rp 5.000 "Biaya
      Marketing" deduction. The screen showed 70.000 − 15.000 − 5.000 = 50.000,
      and the ledger posted:
      `Dr Assets:Cash:BankBCA 50.000` (actual cash received),
      `Dr Expenses:OpEx:KomisiOnline 20.000`,
      `Cr Income:Sales:Online 70.000`. Balanced. Revenue is recognised GROSS and
      the platform's cut is expensed, which matches the CALK policy that online
      revenue is recognised at pencairan.
      Laba Rugi then showed Penjualan Online 70.000, KomisiOnline −20.000, laba
      bersih 50.000, and Validasi passed 12/12 with the online cross-check
      reporting zero difference.

Worth knowing, not a bug: the ledger folds every deduction into
`Expenses:OpEx:KomisiOnline`, so a line labelled "Biaya Marketing" appears as
commission in the buku besar. The label is NOT lost — `/settlement` Riwayat
keeps Komisi and Biaya Marketing as separate lines against the settlement. If
those costs ever need to be told apart in Laba Rugi, that is a deliberate
change, not a defect.

⚠ **Commission rates are test values.** GoFood is currently 20% + Rp 1.000
because the re-seed left every rate at zero and a zero rate makes the settlement
net to gross. ShopeeFood and GrabFood are still 0. Set the real rates at
`/settings` before going live — a wrong rate silently understates cost of sales.

## Section 6 — backup round-trip — ALL PASS
- [x] `/admin/backup` export did NOT error with real ledger rows present. The
      BigInt replacer holds. 23.8 KB, 28 tables, version 3.
- [x] `journalEntries`, `journalLines` and `ledgerAccounts` are all present, and
      EVERY journalLines amount is a string — zero non-string amounts. Each entry
      has exactly 2 lines summing to 0.
- [x] The dropped tables (ingredients, recipes, expenses, kas pak har, and the
      old UnitClass/pack tables) do NOT appear.
- [x] Restore round-trip proven with a real mutation, not just an idle re-import:
      entry #3 was VOIDED first, then the pre-void backup was restored, and #3
      came back POSTED/SEIMBANG with its Rp 250.000 intact. Entry #1 correctly
      stayed VOID because it was VOID in the backup.

Backup coverage is 28 of the 29 Prisma models. The only omission is
`LoginAttempt`, which is transient throttle state and correctly excluded. CALK
notes are NOT a gap — they live in `AccountingSetting` under a `calk:` key
prefix (`lib/accounting/calkNotesRepository.ts`), which is backed up.
The void link survives: `reversedById` sits on the REVERSING entry (#2 points at
#1), matching `prisma/schema.prisma:404`.

### FIXED — the Import tab showed raw table names
`restore-client.tsx` keeps its own `TABLE_LABELS` map, separate from
`TABLE_OPTIONS` in `backup-client.tsx`, and it was never updated when Warung
Books landed. All ten ledger tables fell through its `?? t` fallback and
rendered as `journalEntries`, `ledgerAccounts` and so on, against the project
rule that the UI is Indonesian. The map also still listed `ingredientPacks`, a
table dropped from the schema on 2026-09-02. Added the ten labels, removed the
stale one, and cross-referenced the three other lists that must stay in sync.
Verified on screen: the import tab now reads "Akun Buku Besar", "Jurnal",
"Baris Jurnal" and so on.

### OPERATIONAL CAVEAT — restore cannot undo anything posted after the backup
Restore is an upsert and never deletes; the UI says so ("Data yang tidak ada di
file backup akan tetap dipertahankan"). The consequence is sharper than that
sentence suggests. In this test, restoring un-voided entry #3 but left its
reversal #9 standing, so the transfer was simultaneously posted AND reversed and
Kas Laci silently went from Rp 250.000 to Rp 0.

**Every balance check still passed** — residual 0, all 9 transactions balanced,
Neraca balanced at Rp 4.101.000 — because an orphan reversal is itself a
balanced entry. Only the Cek Saldo assertion caught it, and only because one
happened to exist. Nothing in Validasi looks for an orphan reversal.

This is not a code bug; it is how upsert restore must behave on an append-only
ledger. It IS a real operational trap: an owner restoring an old backup to
"undo" a mistake will silently double-count every void made since. Recommend
documenting it in the petunjuk — the safe recovery for a bad entry is always a
void, never a restore — and re-running Cek Saldo after any restore.

## Section 2 — the cashier path — ALL PASS (one bug found and fixed)
Run signed in as `dev.kasir` (CASHIER).
- [x] `dev.kasir` can open `/buku/belanja` and record a pengeluaran. Recorded
      1,5 x Rp 20.000 = Rp 30.000 ongkir on Kas Laci; "Pengeluaran dicatat".
      This is the first time `recordPengeluaranAsStaff` has ever run for real.
      The page correctly shows no list and no Void for a cashier (add-only).
- [x] `dev.kasir` is redirected to `/beranda` from `/buku`, `/buku/laporan` and
      `/buku/jurnal` — and also from `/buku/kas`, `/buku/pengeluaran`,
      `/buku/bulan`, `/buku/setup` and `/buku/kategori`, which I checked too.
- [x] `/expenses` redirects to `/buku/belanja`.
- [x] Bonus: `/akun` correctly hides the Admin row for a cashier.

### BUG FOUND AND FIXED — /buku/belanja was unreachable for every cashier
The page gated itself with `requireAuth()` as designed, but then read its two
lists through `listCategories()` and `listCashAccounts()` from
`app/actions/admin/queries`, and both call `requireOwner()`. So a cashier was
redirected to `/` and on to `/beranda` — while `/beranda` kept showing them a
"Belanja" tile that bounced straight back. The one cashier-facing page under
`/buku` did not work for cashiers at all.

Fixed by reading `ExpenseRepository` and `CashAccountRepository` directly. That
is the correct layer: this is a server component, `requireAuth()` above is its
gate, and the `app/actions/admin/queries` exports are thin requireOwner()
wrappers built for client callers.

**Why every gate missed it.** `test/buku-pengeluaran.test.ts` already carried a
source guard asserting the page calls `requireAuth()` and not `requireOwner()`.
It passed the entire time, because it checked the gate and not whether the page
could actually READ as a cashier — a proxy for the failure rather than the
failure itself. Added a second guard asserting the page never imports from
`app/actions/admin/queries`, and confirmed it fails against the old file.

## Verification
`npm test` 330 passed + 1 skipped, `npm run lint` clean, tsc clean.

## Current ledger state
The database was wiped, migrated and re-seeded on 2026-09-03, so the UAT rows
above are gone. It now holds exactly the settlement test: one GoFood sale of
Rp 70.000 and journal entry #1, the settlement posting. The journal sequence
starts clean at 1 with the new unique index in force.

## What is left
Nothing in the plan. All seven sections pass.

Two items were deliberately not re-run after the wipe, because they were already
proven before it and re-proving them costs another full day of test data: the
laporan-vs-`/kas` cross-check for the same period, and the locked-month register
close showing "Belum tercatat ke buku besar". Both are in section 5's and
section 3's notes above.

~~Before cutover: set the real online commission rates, then wipe and re-seed so
the books start clean at the cutover date via Saldo Awal.~~

**SUPERSEDED 2026-09-06 — DO NOT WIPE.** Adi decided the April-onward history
STAYS in the database. kasir goes live carrying the migrated books rather than
starting from a Saldo Awal at the cutover date, so there is no cutover wipe.

Two consequences of that decision:
- The known divergence from Warung Books (cumulative Rp 73.993 on Neraca, from
  input differences documented in docs/migrasi-data.md, not code defects) is
  ACCEPTED and stays in the books permanently.
- August's bookkeeping still has to be entered by hand, because the history is
  continuous. A clean start would have made that unnecessary; keeping the
  history means it is still required.

Setting the real online commission rates is still needed for future
settlements. It is simply no longer tied to a wipe.
