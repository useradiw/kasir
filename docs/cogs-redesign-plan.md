# COGS Redesign — Plan & Spec

Status: **Phase 1 shipped (code-only)**, 2026-06-02. Supersedes the unit/pack model in `cogs-feature.md`.

## What shipped (Phase 1 — no DB migration)

Implemented entirely in code by **reusing existing columns with new semantics** so the
production schema is untouched (safest path):

- `Ingredient.baseUnit` now holds the **free-text unit** (gram/ml/butir/pcs). No `UnitClass`
  enforcement, no `resolveBaseUnit`. Create/edit take a free `unit` string.
- `Ingredient.averageUnitCost` now holds the **last purchase cost** (no WMA). `recomputeLastCost`
  in `lib/cogs-utils.ts` re-derives it from the latest purchase row on every purchase/edit/delete.
- `IngredientPurchase.packQty`/`baseQty` carry the **qty in the ingredient's unit** directly;
  `packLabel` is a free-text note. No pack resolution → **expense→ingredient linking no longer
  throws** (the original blocker). `linkExpenseItemsToIngredient` accepts an optional per-item
  `qtyOverrides` so the UI can correct "2 dus" → "60 butir" at link time.
- Assembly (`assembleIngredient`) sets parent cost = `Σ(component qty × cost) / producedQty` —
  recomputed from current component costs each run (no blend).
- Purchase edit/delete (`ingredient-purchases.ts`) dropped the entire `replayIngredientHistory`
  engine; now a simple stock delta + `recomputeLastCost`.
- New `changeIngredientUnit(id, newUnit, factor)` — guided conversion that rescales stock, cost,
  all recipe quantities (menu + olahan), purchase ledger, and movement logs atomically.
- UI: free-text unit inputs (3-decimal via `DecimalInput`), class/pack/normalization removed from
  the ingredient list + detail Settings + edit-purchase dialog; "Satuan & Konversi" nav removed.
- Verified: `tsc --noEmit` clean, `eslint` clean.

## Deferred (later, lower priority)

- **Destructive schema cleanup** (drop `UnitClass`, `IngredientPack`, `unit_base_*` settings,
  rename `averageUnitCost`→`unitCost`, `baseUnit`→`unit`, drop dormant purchase columns). Needs a
  prod migration + DB-connection confirmation.
- Cosmetic `UnitClassBadge` still rendered (from dormant `unitClass` data) in `resep-menu`,
  `resep-olahan`, and the (now-unlinked) `satuan` page. Harmless; remove during the cleanup.
- The "Satuan Pack" card in ingredient detail still exists but is now cosmetic (engine ignores packs).
- Runtime verification against the **dev DB** (not done — requires DB-connection confirmation).

The original full spec follows below.

---

## Goal

Replace the current per-class base-unit + `IngredientPack` + WMA + replay machinery with a drastically simpler model that the store owner can actually reason about, while keeping live stock tracking and accurate COGS.

Decisions locked with the owner:

- **Live stock + COGS** (sales deduct stock; waste/opname/void kept).
- **Cost = last purchase price** per unit (no weighted moving average).
- **Olahan (assembled ingredient) cost = recomputed from current component costs on every production run.**
- **One free-text unit per ingredient.** No `UnitClass`, no enforced `mg/ml/pcs`, no pack table.

## Core principle: one unit per ingredient

Each ingredient has a single, free-text `unit` (`"butir"`, `"gram"`, `"ml"`, `"pcs"`, …). That same unit is used for **stock count, recipe quantities, and cost**. The recipe never converts — recipe-unit *is* stock-unit. Conversion from market/bulk units happens **only at the purchase line, entered manually by the user** (they type the qty already expressed in the ingredient's unit).

---

## Schema changes (`prisma/schema.prisma`)

This is a **production DB** — all steps additive first; destructive drops happen last, after verification.

### `Ingredient` (modified)

```prisma
model Ingredient {
  id            String   @id @default(uuid())
  name          String   @unique
  category      IngredientCategory @default(BAHAN)
  unit          String   @default("pcs")   // FREE TEXT — single unit for stock/recipe/cost
  currentStock  Float    @default(0)
  unitCost      Float    @default(0)        // Rp per `unit` = unit cost of latest purchase
  lowStockAlert Float?
  defaultSupplierId String?
  tags          String[] @default([])
  isActive      Boolean  @default(true)
  notes         String?
  // ... relations unchanged
}
```

Removed/retired fields: `baseUnit`, `unitClass`, `averageUnitCost`, `lastUnitCost`.
- `unit` backfilled from old `baseUnit`.
- `unitCost` backfilled from old `averageUnitCost`.

### Dropped entirely

- `enum UnitClass`
- `model IngredientPack` (+ relation on `Ingredient`)
- `Setting` rows `unit_base_weight` / `unit_base_volume` / `unit_base_count`

### `IngredientPurchase` (simplified)

```prisma
model IngredientPurchase {
  id            String   @id @default(uuid())
  ingredientId  String
  supplierId    String?
  expenseItemId String?  @unique
  source        IngredientPurchaseSource   // EXPENSE | ADJUSTMENT | OPNAME_GAIN | ASSEMBLY
  qty           Float                       // in ingredient.unit (was packQty × baseQty)
  totalCost     Int
  unitCost      Float                       // totalCost / qty
  packNote      String?                     // optional free-text memory e.g. "2 dus"
  purchasedAt   DateTime @default(now())
  recordedById  String?
  notes         String?
}
```

Removed: `packLabel`, `packQty`, `baseQty`, `avgUnitCostAfter`, `stockAfter` (these existed to support WMA + replay, both gone).

### Unchanged

`Recipe`, `RecipeIngredient`, `IngredientRecipe`, `IngredientRecipeItem`, `IngredientLog`, `StockOpname`, `StockOpnameLine`, `Transaction.cogs`, `Supplier`. (`RecipeIngredient.quantity` is already in base unit → no data change.)

> Legacy `templateId` columns on `RecipeIngredient` / `IngredientLog` / `ExpenseItem` stay dormant per the existing templateId trap — never written, read with `ingredientId ?? templateId` fallback.

---

## Engine rewrite (`lib/cogs-utils.ts`)

### Delete

- `resolvePackBaseQty` (the throw that blocks expense linking)
- WMA folding inside `recordPurchasesBatch`
- `editPurchase` + `replayIngredientHistory` (in `ingredient-purchases.ts`) — **no replay needed**

### Cost rule

`Ingredient.unitCost` = `unitCost` of the **most recent** `IngredientPurchase` (by `purchasedAt`) with `source = EXPENSE`. Helper:

```
recomputeLastCost(tx, ingredientId):
  latest = latest EXPENSE purchase by purchasedAt
  if latest: ingredient.unitCost = latest.unitCost
  else: leave unitCost unchanged   // deleting all purchases doesn't zero a known cost
```

### `recordPurchasesBatch` (simplified)

For each line: `unitCost = totalCost / qty`; insert `IngredientPurchase` (+ `IngredientLog` PURCHASE, qty positive); `currentStock += qty`. After the batch, per ingredient set `unitCost = recomputeLastCost(...)`. No pack lookup, no average.

### `reversePurchasesBatch` (edit/delete)

Decrement stock by `qty`; write ADJUSTMENT log; delete the purchase rows; then `recomputeLastCost(...)`. (Trivial — replay engine gone.)

### `computeOrderCogs` (mostly unchanged)

`cogs += recipeIngredient.quantity × order.qty × ingredient.unitCost`; build SALE movements. Reads `unitCost` instead of `averageUnitCost`. Package expansion unchanged.

### `applyStockMovements` / `reverseTransactionStock` / `recordWaste` / `recordOpnameLine`

Logic unchanged except they read `unitCost`. `recordOpnameLine` OPNAME_GAIN purchase uses `qty = delta`, `unitCost = current unitCost` — does **not** change cost (gain at current cost), consistent with last-cost model.

---

## Olahan (assembled ingredient) production

`assembleIngredient` (`ingredient-recipes.ts`), per production of `n` batches with parent `yieldQty` per batch:

```
totalCost = Σ (component.quantity × n × component.unitCost)   // current component costs
producedQty = yieldQty × n
parent.currentStock += producedQty
parent.unitCost = totalCost / producedQty     // recomputed from CURRENT component costs
```

Consume each component's stock (SALE/ASSEMBLY-consume log), write parent ASSEMBLY purchase + log. Parent cost reflects current component costs at the moment of production — matches the owner's decision.

---

## Expense → ingredient linking (the currently-blocked feature)

Two paths, both now free of the pack throw:

1. **Recording a new expense** (`app/actions/expenses.ts`, `app/actions/admin/expenses.ts`): each ingredient-linked item → purchase with `qty = item.amount`, `totalCost = round(item.amount × item.cost)`. `item.unit` becomes `packNote` (memory only). No pack resolution.

2. **Linking historical expense items** (`linkExpenseItemsToIngredient`, `getUnlinkedExpenseItems`): the UI must let the user **confirm/edit the qty in the ingredient's unit** before linking, because an old item's free-text `unit`/`amount` may not already be in the target ingredient's unit (e.g. item says "2 dus", ingredient is in "butir"). Flow:
   - show unlinked items with their original `amount` + `unit` text + `cost`,
   - user picks target ingredient and types/accepts `qty` (in ingredient unit) per item,
   - link writes `ExpenseItem.ingredientId` + a purchase (`qty`, `totalCost = amount × cost`), then `recomputeLastCost`.
   - **No throw** if units don't line up — the user reconciles it once, visibly.

---

## Pages / actions to change or remove

| File | Action |
|---|---|
| `prisma/schema.prisma` | modify Ingredient/IngredientPurchase; drop UnitClass + IngredientPack |
| `lib/cogs-utils.ts` | rewrite per above |
| `lib/unit-class.ts` | **delete** |
| `app/actions/admin/unit-settings.ts` | **delete** |
| `app/admin/bahan/satuan/*` | **delete** (nav entry too) |
| `app/actions/admin/ingredient-purchases.ts` | drop replay; simplify edit/delete |
| `app/actions/admin/ingredients.ts` | drop pack actions; `unit` free text; `setIngredientCost` writes `unitCost` |
| `app/actions/admin/ingredient-recipes.ts` | `assembleIngredient` cost rule above; drop cross-class warnings |
| `app/actions/admin/recipes.ts` | unchanged logic (qty in unit) |
| `app/actions/admin/expenses.ts`, `app/actions/expenses.ts` | drop pack, `qty = amount` |
| `app/actions/push-transaction.ts` | read `unitCost` |
| `app/actions/admin/queries/*` (recipe, ingredient, menu-performance) | read `unit`/`unitCost` |
| `app/admin/ingredients/*`, `app/admin/bahan/*` | remove class/pack/normalization UI; add free-text unit + link-qty confirm |
| `components/shared/badge.tsx` | remove `UnitClassBadge` |
| `app/actions/admin/backup.ts` / `restore.ts` | adjust to new fields |
| `lib/settings.ts` | remove `unit_base_*` defaults |

---

## Migration sequence (production-safe)

1. **Additive migration**: add `Ingredient.unit`, `Ingredient.unitCost`; add `IngredientPurchase.qty`, `.packNote`. Backfill:
   - `unit = baseUnit`
   - `unitCost = averageUnitCost`
   - `IngredientPurchase.qty = baseQty` (existing rows already store base qty)
2. **Ship new code** reading the new fields; old fields still present (dual-read safety).
3. **Verify** in prod with a read-only script (counts, spot-check a few ingredients' cost/stock).
4. **Destructive migration** (separate, later): drop `IngredientPack`, `UnitClass`, old `Ingredient`/`IngredientPurchase` columns, `unit_base_*` settings.

---

## Open questions to resolve before coding

1. **Rounding**: keep `unitCost` as `Float` (avoids drift on `totalCost/qty`); `Transaction.cogs` stays `Int` (rounded once). OK?
2. **Renaming a unit after history exists**: free text means changing `"g"`→`"kg"` does NOT rescale stock/cost numbers. Show a warning, no auto-rescale (same stance as today). OK?
3. **Negative stock** (sale synced before purchase recorded): allow, warn in UI — unchanged from today. OK?
4. **Olahan whose component has `unitCost = 0`** (never purchased): parent cost partial, same as menu COGS today. Acceptable?
