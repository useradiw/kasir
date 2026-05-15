# Design System — Kasir POS

Apple HIG-inspired design language, adapted for a mobile-first POS web app. This document is the source of truth for all UI decisions going forward. Update it when a real decision changes — not when a trend does.

---

## Quick reference

| Element | Class |
|---------|-------|
| Card surface | `rounded-2xl border bg-card` |
| List row (admin) | `rounded-lg border bg-card` (admin only — tighter density) |
| Button shape | `rounded-4xl` (pill) — comes free from `<Button>` |
| Input shape | `rounded-4xl` — comes free from `<Input>` |
| Badge | `rounded-full` |
| Primary color | teal `oklch(0.511 0.096 186.391)` via `bg-primary` |
| Warning color | `bg-warning/10 text-warning-foreground` (new token, see globals.css) |
| Error color | `bg-destructive/10 text-destructive` |
| Numeric columns | always add `tabular-nums` |
| Page heading | `<AdminPageHeader title="…" />` or `<PageHeader title="…" />` |

---

## 1. Tokens (source of truth: `app/globals.css`)

### 1.1 Never hardcode colors

All colors are OKLch semantic tokens defined in `app/globals.css` `:root` and `.dark`. Use Tailwind utility classes — never `oklch(…)`, `#hex`, or `rgb()` in components.

```
bg-primary          text-primary          (teal — primary CTAs, selected state)
bg-muted            text-muted-foreground (inactive, secondary)
bg-destructive/10   text-destructive      (errors, delete actions)
bg-warning/10       text-warning-foreground (PENDING / unsettled / Kas Pak Har)
bg-card             text-card-foreground  (card backgrounds)
bg-background       text-foreground       (page surface)
```

**Chart colors** — read from CSS tokens at runtime via `useChartColors()` in `report-client.tsx`. Never pass a hex string to Recharts directly.

### 1.2 Radius scale

```
rounded-sm   ≈  6px
rounded-md   ≈  8px
rounded-lg   ≈ 10px  — admin list rows, small panels, ErrorBanner
rounded-xl   ≈ 14px
rounded-2xl  ≈ 18px  — cashier cards, card surfaces
rounded-3xl  ≈ 22px
rounded-4xl  ≈ 26px  — buttons, inputs, pills (automatic via Button/Input)
rounded-full        — badges
```

**Rule**: cashier cards → `rounded-2xl`. Admin table rows → `rounded-lg`. Buttons/inputs → pill (`rounded-4xl`, automatic). Do not flatten to `rounded-md` "for a modern look."

### 1.3 Spacing

8px Tailwind grid. Standard scale: `0.5 1 1.5 2 3 4 6 8 12 16`. No arbitrary `px-[13px]` values.

---

## 2. Components

### 2.1 Always use `<Button>` — never raw `<button>` for interactive controls

The `<Button>` component (`components/ui/button.tsx`) provides for free:
- Pill shape (`rounded-4xl`)
- Focus ring (`focus-visible:ring-[3px] ring-ring/50`)
- Active press (`active:translate-y-px`)
- Disabled styling
- Loading state pattern (pass `disabled` + swap label for `<Loader2 className="animate-spin" />`)

**Variants**: `default` (primary teal), `outline`, `secondary`, `ghost`, `destructive`, `link`.  
**One primary button per screen.** Secondary actions → `variant="outline"` or `"ghost"`. Destructive → `variant="destructive"` + `<ConfirmDialog>`.

Raw `<button>` is only acceptable for non-interactive structural elements (e.g., accordion toggle triggers that are purely cosmetic). Even then, prefer `<Button variant="ghost">`.

### 2.2 Card surfaces

**Cashier** (mobile, tappable cards):
```tsx
<div className="rounded-2xl border bg-card p-3 cursor-pointer active:bg-accent active:scale-[0.98] transition-all duration-150">
```

**Admin** (data rows, denser):
```tsx
<div className="rounded-lg border border-foreground/10 p-3">
```

**Structured form/data cards** — use `<Card>` from `components/ui/card.tsx`:
```tsx
<Card><CardHeader>…</CardHeader><CardContent>…</CardContent></Card>
```
Card padding is `px-6 py-6` (default) or `px-4 py-4` (`size="sm"`). Do not manually override with `p-3` — use `size="sm"` instead.

### 2.3 Badges

Four variants in `components/shared/badge.tsx`:
- `<Badge>` — generic, use `className` for color overrides
- `<RoleBadge role={…} />` — OWNER/MANAGER/CASHIER/STAFF
- `<StatusBadge />` — active/inactive product status
- `<SyncBadge synced={…} />` — cashier sync indicator

**Do not inline `<span className="rounded-full …">` for status** — extend one of the badge exports instead.

### 2.4 Page headings (admin)

```tsx
import { AdminPageHeader } from "@/components/admin/ui";

// Simple heading
<AdminPageHeader title="Transaksi" />

// With action buttons (right side)
<AdminPageHeader title="Pengeluaran">
  <Button size="sm" variant="outline">PDF</Button>
  <Button size="sm">+ Tambah</Button>
</AdminPageHeader>
```

Exception: pages with complex wrapping control rows (e.g., `/admin/reports` where the heading sits alongside period selectors) may keep a raw `<h1 className="text-2xl font-bold mr-auto">` inside their own flex wrapper.

### 2.5 Numeric displays

Add `tabular-nums` to any number displayed in a column or alongside other numbers of varying length:

```tsx
<span className="text-sm font-medium tabular-nums">{formatRupiah(total)}</span>
<p className="text-3xl font-bold tabular-nums">{formatRupiah(grandTotal)}</p>
```

Always format rupiah via `formatRupiah()` from `lib/format.ts`. Never display a raw integer amount.

---

## 3. Layout

### 3.1 Container

`<Container>` from `components/shared/container.tsx` — defaults to `max-w-lg mx-auto py-3 px-3 md:px-0`. **Both cashier and admin use `max-w-lg`** (mobile-first for all surfaces).

### 3.2 Cashier shell pattern

```
<Container sectionStyle="min-h-screen flex flex-col">
  <KasirTopBar title="…" onBack={…} onHome={…} />   ← sticky h-12
  <main className="flex-1 overflow-y-auto …">         ← scrolls
  <BottomBar>                                          ← sticky, one primary CTA
    <Button size="lg" className="w-full">…</Button>
  </BottomBar>
</Container>
```

### 3.3 Admin page pattern

```
<Container className="py-6 space-y-6">
  <AdminPageHeader title="…">{optional actions}</AdminPageHeader>
  <Card>…</Card>
  …
</Container>
```

`space-y-6` (24px) between Cards is the established rhythm.

---

## 4. Tap targets (Apple HIG — 44px minimum)

| Element | How to achieve |
|---------|---------------|
| KasirTopBar back/home icons | `p-2.5` (40×40px total) |
| QtyControl +/- | `size="icon-sm"` (32×32) |
| Card edit pencils | `p-3 -m-2` (extends hit area, no layout disruption) |
| Remove item X | `p-2 -m-1` |
| Split group add/remove | `size="icon-sm"` |
| Primary cashier actions | `size="lg"` full-width in BottomBar |

---

## 5. Motion

- Card press: `active:scale-[0.98] active:bg-accent transition-all duration-150`
- Button press: `active:translate-y-px` (built into `<Button>`)
- Transitions: `transition-colors duration-150` for color-only changes
- **No** parallax, scroll-linked animation, backdrop blur (on non-sticky elements), or auto-playing loops

---

## 6. Accessibility

- Icon-only buttons **must** have `aria-label` in Indonesian
- Status is never communicated by color alone — use `StatusBadge` / `SyncBadge` (text + color)
- Focus rings are built into `<Button>` and `<Input>` — do not strip them
- Tappable card divs need `role="button" tabIndex={0} onKeyDown` for Enter key — see `SessionCard` as the reference implementation

---

## 7. Copy (Bahasa Indonesia)

| Pattern | Example |
|---------|---------|
| Save | `Simpan` |
| Cancel action | `Batal` |
| Void/cancel transaction | `Batalkan` |
| Delete | `Hapus` |
| Loading | `Memuat...` |
| Empty | `Belum ada [thing]` |
| Generic error | `Terjadi kesalahan.` |
| Success | `Berhasil!` or specific: `Pesanan berhasil disimpan` |
| Confirm destructive | `Yakin?` / name the specific consequence |

Sentence case always. Buttons name the outcome (`Bayar Rp25.000`), not the act (`Submit`).

---

## 8. What not to do

- ❌ Hardcode `#hex`, `rgb()`, `oklch()` values in components — add to `globals.css` tokens first
- ❌ Use raw `<button>` for interactive controls — use `<Button>`
- ❌ Use `rounded-md` on interactive cards — use `rounded-2xl` (cashier) or `rounded-lg` (admin rows)
- ❌ Omit `tabular-nums` on columnar price lists
- ❌ Skip `aria-label` on icon-only buttons
- ❌ Add `!max-w-4xl` or other wide container overrides — admin stays `max-w-lg` (mobile-first)
- ❌ Route-based navigation in cashier views — the `view` state machine in `KasirShell` is intentional
- ❌ Block cashier actions on network requests — sync indicators communicate state, they do not gate behavior

---

*Companion doc: `C:\Users\62852\Downloads\design.md` — full Apple HIG rationale and extended spec.*
