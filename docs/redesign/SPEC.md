# Kasir Redesign Spec — "Unified Dark" (Option E, gelap)

Approved direction: **Option E — Square-school unified shell, dark terminal skin.**
Mockup: `option-e-unified.html` (dark variant is the approved skin; light tokens
kept for a future light mode). Research basis: Square 2025 POS redesign (bottom
nav, unified checkout, favorites grid), Dribbble/Behance POS conventions (pinned
dock, oversized numerals, one-thumb payment), 2026 currents (bento home,
expressive type, dark default).

Reference: `docs/design.md` (Apple HIG rules) remains in force where not
superseded here. Everything below supersedes it where they conflict.

---

## 1. Design tokens (dark = default)

Applied as CSS custom properties in `app/globals.css` inside a `:root` scope,
replacing the current OKLch values. Light values stay as `.light` (future use).

| Token | Value | Used for |
|---|---|---|
| `--background` | `#101214` | page bg |
| `--card` | `#181B1F` | cards, sheets |
| `--card-2` | `#1D2126` | nested fills, tracks |
| `--foreground` | `#F1F3F5` | primary text |
| `--muted-foreground` | `#8B96A0` | secondary text |
| `--border` | `#262C33` | hairlines, card edges |
| `--primary` | `#2FD6B5` | accent: CTAs, active tab, money-in highlights |
| `--primary-foreground` | `#06231C` | text on accent |
| `--primary-soft` | `#12312B` | accent-tinted fills |
| `--warning` / `--warning-soft` | `#F2B33D` / `#33290F` | pending, unsynced, unposted |
| `--destructive` / `--destructive-soft` | `#F27E6F` / `#371A16` | void, selisih kurang, errors |
| `--success` / `--success-soft` | `#3ECF8E` / `#12301F` | lunas, seimbang, terkirim |
| `--nav-bg` | `#14171A` | bottom bar |

**Type**: Sora (display + ALL numerals: totals, prices, keypad) + Plus Jakarta
Sans (body, labels). Via `next/font/google`. Every money figure keeps
`tabular-nums`.

**Radii/scale**: cards 18–22px, controls 13–15px, chips 999px. Tap targets ≥44px
(existing rule). Numerals are the hero: totals 34–44px Sora 800, card figures
17–30px.

**Component inventory (new shared pieces, `components/shell/`)**:
`AppShell` (phone frame + bottom nav), `BottomNav` (5 tabs, role-filtered),
`BentoCard`, `MoneyHero` (oversized numeral + label), `Dock` (pinned cart bar),
`AlertRow` (explain + act, every badge has an onward action), `QuickAction` grid,
`Segmented` (item/favorit/keypad & tunai/qris/split), `NumKeypad`, `QuickCash`
chips.

**IA / navigation model** (the real fix):
- Bottom tabs: `Beranda · Jual · Kas · Buku · Akun`. Cashier sees Beranda, Jual,
  Kas, Akun; MANAGER adds Buku read parts; OWNER sees all. DEVELOPER = OWNER.
- Route groups keep working URLs where possible; retired routes redirect
  (`/` → Beranda, `/expenses` → Buku pengeluaran, `/cashregister` & `/admin/cash-register`
  → `/kas`).
- Rule kept: every badge explains itself and links to its fix (AlertRow).
- Rule kept: every column of figures must sum to the total shown.

---

## 2. Per-screen mapping

Legend: [rebuild] new layout on the system · [reskin] keep structure, apply
tokens/components · [merge] absorbs another screen · [new] doesn't exist yet ·
[retire] route removed/redirects.

### Tabs — cashier core

| # | Screen | Treatment | Notes |
|---|---|---|---|
| 1 | **Beranda** `/beranda` (was `/`) | [rebuild] | Bento: Pendapatan hari ini (MoneyHero + spark), Kas di laci, QRIS belum cair, AlertRow stack (unposted days w/ recovery, unsynced count), QuickActions (Tutup Kas, Belanja, Transfer, Laporan). Role-filtered blocks. Replaces hub cards + `/admin` dashboard dead end. |
| 2 | **Jual** `/kasir` | [rebuild] | One checkout surface: Segmented (Item/Favorit/Keypad) + category chips + item grid with inline qty steppers + Dock. Kills the forced "Buat Sesi" gate — first item tap attaches/creates session (name optional, edit later). |
| 3 | ↳ Bayar sheet | [rebuild] | Same surface as a sheet: MoneyHero total, Segmented Tunai/QRIS/Split, QuickCash chips (uang pas/50–100rb), NumKeypad, live kembalian, one confirm button. Split opens grouped payment inline. |
| 4 | ↳ Selesai | [rebuild] | MoneyHero "Lunas", kembalian, mini struk card, primary = Transaksi Baru, secondary = Cetak Struk. Sync note always visible. |
| 5 | ↳ Sesi (part of Jual) | [reskin] | Session cards w/ sync status tag (● n belum terkirim), open vs paid tabs, tap = resume, struk preview modal. |
| 6 | **Kas** `/kas` | [merge] | ONE register surface for all roles: shift status hero, expected-vs-counted with live selisih, tutup kas flow, riwayat with per-day posting tag + "kenapa ini terjadi?" link. OWNER-only controls (edit/delete/recover) rendered conditionally — deletes the `/cashregister` vs `/admin/cash-register` twin. Staff sees the "Belum tercatat" tag too (data already exists). |
| 7 | **Buku** `/buku` (OWNER) | [rebuild] | Keuangan glance: month picker + Validasi pill, MoneyHero Laba Bersih + proportional bars (Pendapatan/HPP/Beban), AlertRows (unposted, month lock state + Tutup Buku), drill-downs. Absorbs `/admin/keuangan` hub. |
| 8 | **Akun** `/akun` (was `/profile`) | [reskin] | Profile, printer, store settings, sign-out, role badge. Absorbs `/settings` basics. |

### Buku children (OWNER)

| # | Screen | Treatment | Notes |
|---|---|---|---|
| 9 | **Setup checklist** `/buku/setup` | [new] | The 5 blocking steps as checked list w/ Continue CTA (seed akun → akun kas → akun penjualan → kategori → bulan+saldo awal). Shown at top of Buku until complete. Fixes the 12–20-tap unguided setup. |
| 10 | Laporan `/buku/laporan` | [reskin] | Keep 6 tabs; numbers restyled as ledger cards; **rows become drill-downs** to jurnal entries. CSV stays. |
| 11 | Jurnal `/buku/jurnal` | [new·split] | Entry list (gapless numbers, Seimbang badge) + entry detail (line pairs, void state, reversing entry). Split out of buku-kas. |
| 12 | Buku Kas `/buku/kas` | [reskin] | Keep Buku Kas/Cek Saldo tabs; ledger grid styling; cek-saldo submit → AlertRow confirmation. |
| 13 | Pengeluaran `/buku/pengeluaran` | [merge] | One entry-form template shared by transfer/modal/prive/saldo-awal. Absorbs cashier `/expenses` (same Catat form, role-gated) → `/expenses` retires to redirect. |
| 14–17 | Transfer / Modal / Prive / Saldo Awal | [merge] | Variants of #13's template; routes kept for links. |
| 18 | Kategori `/buku/kategori` | [reskin] | Seed button always available (not just when empty). |
| 19 | Akun Kas `/buku/akun` | [reskin] | Chart of accounts + "Isi akun default". |
| 20 | Akun Penjualan `/buku/akun-penjualan` | [reskin] | Channel mapping; incomplete state becomes AlertRow on Buku + Setup. |
| 21 | Bulan `/buku/bulan` | [reskin] | Closed-month list, Tutup/Buka/Kunci Paksa; +Bulan moves into month picker (already there). |

### Admin ops (owner/manager, reskinned under same system, reachable from Beranda quick actions + Buku)

| # | Screen | Treatment | Notes |
|---|---|---|---|
| 22 | Transaksi `/admin/transactions` (+detail) | [reskin] | Rows tappable → detail; detail gets drill-links (session, register day). |
| 23 | Settlement `/admin/settlement` (+ cashier `/settlement`) | [merge] | One surface; back-href dies with hub-and-spoke. |
| 24 | Inventori, 25 Performa Menu, 26 Laporan (/admin/reports), 27 Absensi, 28 Staff, 29 Supplier, 30 Sesi Login, 31 Notifikasi, 32 Backup | [reskin] | Token + card system; dashboard-style cards become BentoCards with drill-links (dashboard dead-end fix). |

### Auth & meta

| # | Screen | Treatment | Notes |
|---|---|---|---|
| 33 | Login `/` → `/masuk` | [rebuild] | Dark, brand mark, MoneyHero-scale title. No registration link (invite-only via staff page). |
| 34 | `/auth/daftar` | [retire] | Security finding — remove/gate; staff invites only. |
| 35 | `/auth/cek-email`, `/auth/auth-code-error` | [reskin] | |
| 36 | Petunjuk `/petunjuk` | [split] | Per-topic pages (jual/kas/buku/pengeluaran), linked contextually from screens ("?", "kenapa ini terjadi?"). |
| 37 | error.tsx / global-error / not-found | [reskin] | AlertRow language: what happened + what to do. |

---

## 3. Implementation phases (each shippable, gates: tsc + lint + build + npm test)

- **Phase 0 — Foundations.** Tokens in `globals.css` (dark default, `.light`
  preserved), fonts via next/font, `components/shell/*` (AppShell, BottomNav,
  BentoCard, MoneyHero, Dock, AlertRow, Segmented, NumKeypad, QuickCash),
  role→tabs mapping util. No screen changes yet — zero user impact.
- **Phase 1 — Jual.** Rework `kasir-shell` view machine to checkout surface +
  payment sheet + done; sessions reskin; auto-session on first item; sync tag on
  cards. Highest daily value, touches Dexie flows — hydration checks mandatory.
- **Phase 2 — Kas.** Build `/kas` merged surface (staff + admin variants from
  one client), retire `/cashregister` + `/admin/cash-register` via redirect,
  AlertRow recovery surfaced.
- **Phase 3 — Buku.** Buku tab + setup checklist + jurnal split + entry-form
  template + laporan reskin + keuangan children reskins; retire `/expenses` and
  keuangan hub.
- **Phase 4 — Beranda + admin ops.** Bento home (needs `getDashboardSummary`
  query), admin screens reskin, dashboard drill-links.
- **Phase 5 — Auth & meta.** Login rebuild, daftar removal, petunjuk split,
  error pages, retire old hub.

Safety: app is LIVE. Phases ship behind progressive rollout (theme + new shells
replace routes per-phase); never big-bang. No DB migrations required — this is
presentation + IA only. Petunjuk must be updated per phase (project rule).
