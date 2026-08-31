# design.md — Kasir Unified Design System

The single source of truth for UI work on kasir. Any session restyling or
building a screen MUST follow this file. Visual reference: the HTML mockups in
this folder (`screens-*.html`, `index.html`) and `option-e-unified.html`.
Supersedes the layout rules in `docs/design.md` where they conflict; that
file's accessibility and tap-target rules remain in force.

Status of the rollout lives at the bottom (§9 Route inventory) — update it
with every phase so the next audit is a diff, not an investigation.

---

## 1. Foundations

### 1.1 Tokens (`app/globals.css`)

Dark (`​.dark`) is the primary skin and the ONLY approved look for shell
screens. Light (`:root`) values exist so un-migrated pages stay coherent.

| Token | Dark | Light | Notes |
|---|---|---|---|
| background | `#101214` | white | page |
| card / card-2 | `#181B1F` / `#1D2126` | white / gray-50 | surfaces, nested fills |
| foreground / muted-foreground | `#F1F3F5` / `#8B96A0` | ink / gray | text |
| border | `#262C33` | gray-200 | hairlines only — no heavy borders |
| primary | `#2FD6B5` | teal `oklch(.511 .096 186)` | CTAs, active tab, money-in accents |
| primary-foreground | `#06231C` | white | text on primary |
| success(-soft) | `#3ECF8E` / `#12301F` | green / tint | lunas, seimbang, terkirim |
| warning(-soft) | `#F2B33D` / `#33290F` | amber / tint | pending, unsynced, unposted |
| destructive(-soft) | `#F27E6F` / `#371A16` | red / tint | void, selisih kurang |
| nav-bg | `#14171A` | near-white | bottom tab bar only |

**⚠ Token rules (learned from the warning-foreground regression):**

1. NEVER change the meaning of an existing shadcn token. If a value is wrong
   for dark mode, migrate the *call sites* to a purpose-built token, or pick a
   dark value that keeps the existing call-site pattern readable. Call sites
   outlive token definitions.
2. New tokens MUST be defined in BOTH `:root` and `.dark`.
3 -soft tokens pair with their base: `bg-warning-soft` + `text-warning` is the
   dark-mode badge pattern; `bg-warning/10 text-warning-foreground` is the
   legacy light pattern — do not mix pairs across scopes.
4. Money text is always `tabular-nums` and Sora (`font-display`).

### 1.2 Type

- `font-display` (Sora): headings, ALL numerals (totals, prices, keypad,
  balances), the tab labels' active state.
- `font-body` (Plus Jakarta Sans): everything else. Body font stays Geist on
  un-migrated screens — do not flip the global `--font-sans` until Phase 6.
- Scale: hero numeral `text-[38px]`–`text-[44px]`; card figure `17–30px`;
  body `13–14.5px`; label `11.5px` bold uppercase tracking-wide; tab label
  `10.5px`.

### 1.3 Shape & spacing

- Cards `rounded-2xl` (18–20px); controls `rounded-xl`–`2xl`; chips `rounded-full`.
- Page gutter `px-4`; vertical rhythm `gap-3` between cards.
- Tap targets ≥44px; motion = `active:scale-[0.98] transition-all duration-150`
  on tappables — nothing else animates.
- Max width `max-w-lg` centered (AppShell provides it). Never widen.

---

## 2. Component contract (`components/shell/`)

| Component | Use for | Do NOT use for |
|---|---|---|
| `AppShell` | wrapping ANY migrated screen (dark scope + tab bar) | payment/checkout views that own their bottom bars → pass `nav={false}` |
| `BottomNav` | the 5 role-filtered tabs; never duplicate links beside it | in-content nav |
| `BentoCard` + `CardLabel` | home/buku dashboard blocks | forms, lists of actions |
| `MoneyHero` | THE money figure of a screen (one per screen) | secondary figures — use `font-display text-[17px] font-bold` |
| `AlertRow` | every status that needs attention; MUST carry an onward action (`actionHref`/`onAction`) — badges without actions are forbidden | decorative info |
| `Tag` | row-level status chips (ok/warn/bad/mut/acc) | screen-level alerts |
| `Segmented` | in-surface switchers (Item/Favorit/Keypad; Tunai/QRIS/Split) | page-level navigation |
| `NumKeypad`, `QuickCash`, `Dock` | payment/checkout surfaces only | — |

Legacy patterns being replaced: `Container` pages (un-migrated), `BottomBar`
(menu-browser — visually equivalent to `Dock`, replace during Phase 2),
shadcn `Card` grids (old hub — deleted).

---

## 3. Layout patterns

### 3.1 Screen scaffold (all migrated screens)

```
<AppShell role={staff.role}>
  <header: px-4 pt-5/6, h1 font-display 17px bold, sub 11.5px muted, right: month-pill/segmented>
  <content: px-4 pb-6 pt-3, flex flex-col gap-3>
  ... cards in spec order: alerts FIRST, then hero, then supporting, then quick actions
</AppShell>
```

- Header title is a noun ("Kas", "Buku"), never a sentence. Sub-line carries
  context (month, shift, scope).
- Order matters: **AlertRow stack before everything** — recovery actions are
  the first thing the eye hits.

### 3.2 Bento home (`/beranda` pattern)

2-col grid; first card `wide` with MoneyHero; supporting cards equal width;
quick-action strip last (4-up, icon `bg-primary-soft` tiles). Owner sees
business numbers; cashier sees their own shift; never mix audiences.

### 3.3 Statement/ledger card (laporan, buku kas, jurnal)

`fcard` pattern (see mockups): `fhead` (accent-soft, uppercase label +
right-aligned value) → `frow`s (label muted / value Sora semibold; negatives
`text-destructive`) → `frow total` (2px top rule) → optional `frow grand`
(accent-soft, Sora 18px). **Every column of figures must sum to the total
shown next to it** — pre-existing rule, three real bugs.

### 3.4 Entry form (pengeluaran/transfer/modal/prive/saldo-awal)

ONE template: header (title + scope sub-line) → `field`s (label bold 12px
muted; required marker `<b class="text-destructive">*</b>`; input =
card-bg, border, Sora 15px semibold) → item `line`s where applicable →
`totalbar` → primary `btn` → confirm-note explaining the accounting
consequence in one sentence.

### 3.5 List rows

`.row`: who (13.5px bold) + meta (11.5px muted) left; amount (Sora 14.5px) +
Tag right. Whole row tappable when a detail exists — rows are never
dead ends (dashboard dead-end rule).

### 3.6 Auth & error states

Error/empty states follow AlertRow language: what happened + what to do next,
never a bare "Terjadi kesalahan." Server actions must RETURN error copy as
data (prod redacts thrown messages) — see `app/actions/login.ts`.

---

## 4. Navigation model

1. `BottomNav` is the ONLY global navigation. Five tabs, filtered by role via
   `tabsForRole` (`components/shell/nav-items.ts`).
2. Role grants in `nav-items.ts` are PERMISSIONS: changing them requires the
   owner's explicit approval per role (STAFF×Kas was reverted for exactly
   this).
3. During migration, un-migrated `/admin/*` pages keep the old admin nav, but
   its entries must point at real destinations (`/kas`, `/beranda`) — never at
   redirect stubs (no-op loops).
4. Old hub-and-spoke routes redirect: `/` → `/beranda` (active staff),
   `/cashregister` & `/admin/cash-register` → `/kas`, `/expenses` → Buku
   pengeluaran (Phase 4). Redirect pages keep query strings.
5. Screens that own their bottom bars (payment, checkout) run with
   `nav={false}`; everything else shows the tab bar.

---

## 5. What counts as "done" per route

- **wrapped** = renders inside AppShell (dark tokens apply), nav decision made.
- **reskinned** = wrapped AND its internals use the §2 components/§3 patterns
  (no legacy Card/Container chrome).
- **rebuilt** = reskinned AND flow changes from SPEC.md items landed.

Record the level per route in §9. "Dark by inheritance" alone is level 0.

---

## 6. Rules that keep biting

- Hydration: never seed client state from window/localStorage; use
  `useSyncExternalStore`/Dexie live queries (recurring failure mode).
- Every column of figures must add up to its displayed total.
- Server actions: `"use server"` line 1, only async exports, every export
  gated; pure logic + injectable `db` lives in `lib/`.
- Money: integer rupiah; ledger BigInt; new money rules get unit tests in
  `test/` BEFORE shipping (`test/kasir-money.test.ts` is the precedent).
- Errors: user copy returned as data or via `runAction`'s ActionError —
  never raw `throw new Error` in a server action.
- Petunjuk pages update in the same phase as the screens they explain.

---

## 7. Mockup ↔ code map

| Mockup file | Screens |
|---|---|
| `screens-beranda.html` | /beranda (owner, cashier, pre-open) |
| `screens-jual.html` | /kasir checkout, bayar×3, selesai, sesi |
| `screens-kas.html` | /kas shift, tutup kas, riwayat, detail hari, buka kas |
| `screens-buku.html` | /buku glance, setup, bulan, buku kas, cek saldo |
| `screens-buku-forms.html` | entry-form template + kategori/akun/akun-penjualan |
| `screens-laporan.html` | 5 statements, validasi, jurnal list + detail |
| `screens-admin.html` | transaksi×2, pencairan, inventori, performa, staff, notif+backup |
| `screens-auth.html` | login, cek-email, error states, 404 |

Shared stylesheet `redesign.css` mirrors the tokens above — when a token
changes, update BOTH it and `globals.css`.

---

## 8. Implementation phases (SPEC.md §3, revised order)

0. ~~Foundations~~ — done.
1. ~~Fix queue~~ — done (money model + tests, login data-errors, tokens,
   STAFF revert, stale nav).
2. ~~`/kasir`~~ — done as a RESKIN, not a rebuild. Adi decided (2026-08-31) to
   keep the current flow: no auto-session on first item tap (the "Buat Sesi"
   gate stays) and no change to the split-bill flow. The Favorit and Keypad
   tabs in `screens-jual.html` are therefore NOT built — they are flow
   changes, not styling. All seven views now use the token/type system.
3. `/kas` true rebuild — NEXT.
4. Keuangan re-homing (`/buku/setup`, `/buku/jurnal`, entry-form template,
   12 route reskins).
5. Admin ops reskin (13 routes, dashboard drill-links).
6. Cashier non-admin + meta (expenses merge, settlement, profile, settings,
   petunjuk split, error pages).
7. Auth (login rebuild, daftar decision).

---

## 9. Route inventory (update per phase)

| Route | Level (§5) | Phase |
|---|---|---|
| `/beranda` | rebuilt | 0 |
| `/buku` | rebuilt | 0 |
| `/buku/setup` | rebuilt (functional checklist + seed actions) | 1 |
| `/kas` | wrapped (old clients inside) | 3 |
| `/akun` | rebuilt | 0 |
| `/kasir` | reskinned (7 views: sesi, menu, pesanan, split, bayar, QRIS, selesai) | 2 |
| `/admin/keuangan/*` (12) | untouched | 4 |
| `/admin` + ops (13) | untouched (nav links fixed) | 5 |
| `/expenses`, `/settlement`, `/profile`, `/settings`, `/petunjuk` | untouched | 6 |
| `/` (login + fallback) | partial (login errors fixed; visual rebuild pending) | 7 |
| `/auth/*` | untouched | 7 |
| error.tsx / global-error.tsx / not-found.tsx | untouched | 6 |
