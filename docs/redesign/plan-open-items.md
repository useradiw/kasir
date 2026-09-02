# Open-items plan (drafted 2026-09-01, revised after Adi's feedback)

Five items: (1) rebuild keuangan on `/buku`, (2) login brute-force lockout,
(3) `/kas` Phase 3, (4) admin navigation, (5) retiring the dead HPP-era
features. Section 6 records what was verified.

---

## 1. Rebuild the keuangan screens on `/buku` (redesign Phase 4)

**Decision (Adi, 2026-09-01): do not move the files.** Build each screen fresh
under `/buku`, designed to the redesign doc, one at a time. When every feature
has an equivalent on `/buku`, delete `app/admin/keuangan/` in one commit. No
`git mv`, no catch-all redirect, no half-moved folder.

This is slower per screen but it keeps each step small and reviewable, and it
is the only way the screens actually end up on the new design system instead of
carrying the old admin markup across.

### What has to exist on `/buku` before the old folder can go

Twelve routes, in a build order that follows what blocks what. The target names
come from SPEC lines 78-94.

| Build order | New route | Replaces | SPEC |
|---|---|---|---|
| 1 | `/buku/akun` | `keuangan/akun` | #19 |
| 2 | `/buku/akun-penjualan` | `keuangan/akun-penjualan` | #20 |
| 3 | `/buku/kategori` | `keuangan/kategori` | #18 |
| 4 | `/buku/bulan` | `keuangan/bulan` | #21 |
| 5 | `/buku/pengeluaran` | `keuangan/pengeluaran` + `transfer` + `modal` + `prive` + `saldo-awal` | #13 |
| 6 | `/buku/jurnal` | `keuangan/page.tsx` (the Jurnal list) | #11 |
| 7 | `/buku/kas` | `keuangan/buku-kas` | #12 |
| 8 | `/buku/laporan` | `keuangan/laporan` | #10 |

The first four are the setup screens that `/buku/setup` already links to, so
they unblock the UAT. Five is a merge: SPEC wants one entry-form template
shared by pengeluaran, transfer, modal, prive and saldo-awal, which turns five
old pages into one route with a form variant. Eight is the largest and should
be last.

### The rule for every screen

Reuse the server actions unchanged. `app/actions/admin/queries/*` and
`app/actions/admin/keuangan.ts` are not part of this work — only the pages and
their client components are rewritten. Each new page carries its own
`requireOwner()`; there is no `/buku` layout gate to inherit, and a page that
forgets it becomes publicly reachable.

Design source: `docs/redesign/screens-buku.html` and `screens-buku-forms.html`
for the forms, `screens-laporan.html` for laporan. Read the mockup before
writing each screen, list what it shows, and diff that against what the old
page renders. **Anything the mockup drops that the old page had is a decision
for Adi, not for the rebuild.** Money screens lose features silently otherwise.

### The one invariant

Any column of figures must add up to the total shown against it. That has been
a real bug three times (laporan Gaji, Neraca Ekuitas, Laba Rugi). Every
rebuilt screen that shows a total needs a test, not an eyeball.

### The deletion commit, at the end

Delete `app/admin/keuangan/` and strip the ten `/admin/keuangan/*` hrefs from
`app/admin/layout.tsx` lines 22-36. Also fix
`app/admin/keuangan/laporan/_components/validasi-tab.tsx:59`, a copy string
that tells the owner to check `/admin/cash-register` and should say `/kas` —
carry that fix into the rebuilt laporan rather than leaving it behind. Finally
audit `lib/revalidate.ts`: a `revalidatePath` pointing at a deleted route means
a page silently serves stale numbers after a posting, which is the failure you
would not notice.

Verify per screen with lint, build and tests, then sign in as OWNER and use the
screen for real. Also hit each new route as CASHIER once and confirm it
redirects.

---

## 2. Login brute-force lockout — approved

Today `app/actions/login.ts` accepts unlimited attempts. It is a server action,
so it is a public POST endpoint reachable without any UI. Supabase rate-limits
its own auth endpoint, but the action runs `prisma.staff.findUnique` and
`auth.admin.getUserById` before it ever gets there, so password guessing is
cheap right now.

**Design — the simplest thing that works.** One additive table, counted per
username, with no IP tracking. The warung sits behind one NAT address, so
per-IP counting would lock out the whole shop at once.

```prisma
model LoginAttempt {
  username     String    @id
  failedCount  Int       @default(0)
  lockedUntil  DateTime?
  lastFailedAt DateTime  @default(now())
  @@map("login_attempts")
}
```

The rule: five consecutive failures lock the username for fifteen minutes, and
a successful login deletes the row. Locking the username string rather than the
Staff row means an unknown username locks too. That is deliberate — any
difference in behaviour between a real and a fake username re-opens the
account-enumeration leak the current code carefully closes.

**Code shape.** Pure logic goes in `lib/login-throttle.ts` with an injectable
`db: PrismaClient = prisma` and an injectable clock, because that is the only
way it can be tested against pglite (`test/env-guard.ts` blocks the real
database on purpose). `app/actions/login.ts` calls `checkLock()` before the
Staff lookup and `recordFailure()` or `clearFailures()` around the Supabase
call. The locked state needs its own message, such as "Terlalu banyak
percobaan. Coba lagi dalam N menit." It reveals only that someone has been
trying, never whether the account exists.

**Migration.** One new table, additive, with no foreign key to `staff` so an
unknown username is still storable. Apply it by the reviewed-file procedure in
HANDOFF: write `prisma/sql/2026-09-login-attempts.sql` wrapped in `BEGIN; ...
COMMIT;`, take a backup at `/admin/backup`, run `prisma db execute`, then
`prisma migrate resolve --applied`. Never run `migrate deploy` on this
database.

Tests: lock after five failures, unlock after the window passes, a success
clears the counter, and an unknown username behaves exactly like a known one.
Give this its own session and take the backup first.

---

## 3. `/kas` Phase 3 — what it actually is

**In one sentence: there are three cash-register routes today, all showing one
of two old screens, and Phase 3 builds the one real screen and deletes the
other two.**

The history. There used to be two separate register pages: `/cashregister` for
the cashier's own shift, and `/admin/cash-register` for the owner's view of
every register with edit, delete and recovery. The redesign said one screen for
everyone, called `/kas`, in the new bottom-tab shell.

What exists now. `/kas` was created, but it is only a frame. Look at
`app/kas/page.tsx`: it checks the role and then renders one of the two **old**
client components, imported straight from the old folders, inside the new
`AppShell`. So the new tab works, but it is showing 2025 markup, and the two
old routes are still live and still reachable.

So Phase 3 is both things at once, and they cannot be separated: write the real
Kas screen from `docs/redesign/screens-kas.html`, and once `/kas` no longer
imports the old clients, delete the two old routes. Deleting them earlier would
break `/kas`, because `/kas` is currently made of them.

Work order:

1. Read `screens-kas.html`, list every element, diff against what the two old
   clients render. Anything the mockup drops is Adi's call.
2. New markup goes in `components/kas/*`, split by role at the component level.
   The server page stays the single data fetcher it already is
   (`getCashRegisterData` and `getCashRegisterDataForStaff`). **Add no new
   query functions** — the reconciliation numbers have exactly one source of
   truth in `lib/shell-queries.ts` and `queries/_shared.ts`.
3. Add the back button the audit asked for, plus the period selector the admin
   view already drives through `?from=` and `?to=`.
4. Delete `app/cashregister/` and `app/admin/cash-register/` in the same commit
   that stops importing them, and drop the matching
   `revalidatePath("/admin/cash-register")` lines from `lib/revalidate.ts`.

Same totals invariant as section 1; extend `test/shell-queries.test.ts`.

Verify as CASHIER (open and close a register, watch the lock countdown) and as
OWNER (edit, delete, recovery). A hydration check in a fresh tab is mandatory,
because this screen sits next to Dexie state and hydration bugs recur here.

---

## 4. Admin navigation

Three decisions from the feedback.

**Retire `app/admin/page.tsx`.** Approved. Its four stat cards duplicate the
`/beranda` bento, and nothing links to it except its own navigation dropdown.
Do this together with the navigation rebuild below, not before — `/admin` must
still resolve to something.

**The duplicate pairs.** `/cashregister` and `/admin/cash-register` are
section 3's work, yes. The other two are separate: `/expenses` retires when
`/buku/pengeluaran` is built (section 1, step 5), and `/admin/settlement` is a
thin duplicate that can go now — see section 5.

**Build a real admin navigation.** Today the only way into staff management is
a dropdown inside `app/admin/layout.tsx`, which is a dead end for a MANAGER on
a phone. The fix is to make `/admin` itself the index: replace the retired
dashboard with a grouped list page in the new design system, and reach it from
the existing Admin link on `/beranda` plus a new one on `/akun`.

After sections 1, 3 and 5 land, the admin surface is small enough to list on
one screen:

- **Staff** — Kelola Staff, Sesi Login, Absensi
- **Menu** — Inventori Menu, Performa Menu (owner only), Supplier
- **Penjualan** — Laporan, Transaksi, Pencairan Online
- **Sistem** — Notifikasi (owner), Backup DB (owner), Pengaturan Toko (owner)

Keuangan disappears from this list entirely — it is `/buku`, reached from its
own link. Once `/admin` is that index page, the layout dropdown is redundant
and goes with it.

Sequence this **after** section 1, otherwise the list is written twice.

---

## 5. Retiring the dead HPP-era features

Adi is right that Warung Books replaced the old costing system. The COGS
screens themselves were already deleted in Slice 1, but their supporting
surfaces were not, and one is a live orphan.

**`/admin/suppliers` — KEEP (Adi, 2026-09-01).** It is an orphan today, but it
is wanted for future work, so nothing about it is deleted. Verified for the
record: `app/actions/admin/suppliers.ts` only ever touches `prisma.supplier`,
and no other page, action or component reads supplier data — it was the
counterparty on the dormant `IngredientPurchase`. Two consequences of keeping
it. It stays in the admin navigation list in section 4, under Menu rather than
Keuangan, because it no longer has anything to do with the ledger. And it needs
a why-comment at the top of the page saying it is intentionally unwired and
kept for future purchasing work, or the next audit will flag it as dead code
all over again.

**`/admin/settlement` — retire.** Verified: it imports the exact same
`SettlementClient` as `/settlement`, differing only by excluding CASHIER and
passing `backHref="/admin"`. Delete the admin copy and point the navigation
entry at `/settlement`.

**`/admin/reports` — keep.** It looks like an old HPP screen but it is not.
Its HPP row is labelled "dari pengeluaran bahan baku" and reads the buku besar,
so it was already migrated during the merge. It is the sales and operations
report, and `/buku/laporan` is the financial-statement report. Different
things.

**`/admin/inventory` — keep.** This is menu inventory (item availability), not
bahan baku.

**The dormant models stay.** `Expense`, `ExpenseItem`, `ExpenseTemplate`,
`KasPakHar`, `Supplier`, and the COGS models (`Ingredient*`, `Recipe*`,
`StockOpname*`) remain in `schema.prisma` with data intact and backed up.
Retiring a screen never means dropping a table here.

Petunjuk carries supplier instructions and must be updated in the same commit
that deletes the screen.

---

## 6. Verification log (2026-09-01)

- `app/admin/keuangan/page.tsx` **does** hold unique content: it is the Jurnal
  entry list, with balanced/unbalanced badges and per-line debit and credit
  rows. `/buku` has no equivalent. It becomes `/buku/jurnal` (SPEC #11), step 6
  in section 1.
- `/settlement` and `/admin/settlement` **do** share one client component,
  `app/settlement/settlement-client.tsx`. The admin copy adds nothing but a
  role restriction and a back link. Retired in section 5.
- `app/actions/admin/suppliers.ts` touches only `prisma.supplier`; no other
  file in `app/`, `lib/` or `components/` reads supplier data outside backup
  and restore. Basis for the retirement above.
