# Migration-history audit — unrecorded migrations vs `schema.prisma`

**Read-only audit, 2026-08-30.** No database was connected. Every "schema declares"
below was read from `prisma/schema.prisma` at commit 9095084 (+ working tree).
Comparing against the **real production schema** is a separate step, done
together, against the live database — this document only predicts what Prisma
thinks from the repo.

## Background

`HANDOFF.md` records that production's `_prisma_migrations` table holds only 4 of
the migrations — `add_developer_role`, `add_ingredient_recipes`,
`add_unit_class_and_ingredient_extras`, and `widen_costs_to_float` were applied to
production but never recorded. `prisma migrate deploy` treats every filesystem
migration missing from that table as **PENDING and replays its SQL in full**.

The repo contains **7** migration directories (init … `20260726000000_warung_books`).
HANDOFF's "4 of 8" implies an 8th migration somewhere — if the recorded 4 are
init, `add_ingredient_model`, and `warung_books`, the repo only accounts for 7
total. Nothing was deleted from `prisma/migrations` in git history. **Open
question for the live DB check**: what the recorded 4 actually are, and whether an
8th migration exists outside the repo.

Policy remains: **never** `prisma migrate deploy` / `db push` / `migrate reset`
against production. Additive DDL goes through a reviewed `BEGIN; … COMMIT;` file
via `prisma db execute`, then `prisma migrate resolve --applied`.

---

## 1. `20260522000000_add_developer_role`

`ALTER TYPE "RoleEnum" ADD VALUE 'DEVELOPER';`

| Object | Migration does | Schema declares | Verdict |
|---|---|---|---|
| `RoleEnum` (enum) | Adds value `DEVELOPER` | `RoleEnum { OWNER, MANAGER, CASHIER, STAFF, DEVELOPER }` | **AGREES** |

Replay outcome: fails with a duplicate-value error (the value already exists in
production).

## 2. `20260522120000_add_ingredient_recipes`

Two enum additions, two new tables, one unique index, three FKs. All tables are
now in the DORMANT block (models kept, code retired in Slice 1).

| Object | Migration does | Schema declares | Verdict |
|---|---|---|---|
| `IngredientPurchaseSource` (enum) | Adds value `ASSEMBLY` | Enum includes `ASSEMBLY` | **AGREES** |
| `StockMovementType` (enum) | Adds value `ASSEMBLY` | Enum includes `ASSEMBLY` | **AGREES** |
| `ingredient_recipes` | CREATE TABLE: `id` TEXT PK, `ingredientId` TEXT NOT NULL, `yieldQty` DOUBLE PRECISION NOT NULL DEFAULT 1, `notes` TEXT, `createdAt`/`updatedAt` TIMESTAMP(3) | `IngredientRecipe` (@@map `ingredient_recipes`): id uuid, ingredientId String @unique, yieldQty Float @default(1), notes String?, createdAt/updatedAt | **AGREES** |
| `ingredient_recipes.ingredientId` | UNIQUE INDEX `ingredient_recipes_ingredientId_key`; FK → `ingredients` ON DELETE CASCADE | `@unique`; relation `onDelete: Cascade` | **AGREES** |
| `ingredient_recipe_items` | CREATE TABLE: `id` TEXT PK, `recipeId` TEXT NOT NULL, `ingredientId` TEXT NOT NULL, `quantity` DOUBLE PRECISION NOT NULL | `IngredientRecipeItem` (@@map `ingredient_recipe_items`): id, recipeId, ingredientId, quantity Float | **AGREES** |
| `ingredient_recipe_items.recipeId` | FK → `ingredient_recipes` ON DELETE CASCADE | relation `onDelete: Cascade` | **AGREES** |
| `ingredient_recipe_items.ingredientId` | FK → `ingredients` ON DELETE RESTRICT | relation has no `onDelete` → Prisma default Restrict | **AGREES** |

Replay outcome: fails on `CREATE TYPE`/`CREATE TABLE` — objects already exist.

## 3. `20260526120000_add_unit_class_and_ingredient_extras`

| Object | Migration does | Schema declares | Verdict |
|---|---|---|---|
| `UnitClass` (enum) | CREATE TYPE (`WEIGHT`, `VOLUME`, `COUNT`) | **Nothing — no `UnitClass` enum exists in the schema** | **DIFFERS** |
| `ingredients.unitClass` | ADD COLUMN `"UnitClass" NOT NULL DEFAULT 'COUNT'`, then backfills every row from `baseUnit` via a CASE table | **Nothing — `Ingredient` has no `unitClass` field** | **DIFFERS** |
| `ingredients.defaultSupplierId` | ADD COLUMN TEXT, nullable; FK → `suppliers` ON DELETE SET NULL | `defaultSupplierId String?` + relation `onDelete: SetNull` | **AGREES** |
| `ingredients_defaultSupplierId_idx` | CREATE INDEX on `defaultSupplierId` | **No `@@index([defaultSupplierId])` on `Ingredient`** — the Prisma-generated init migration contains zero `CREATE INDEX` statements, i.e. Prisma does not auto-create FK indexes, so this index is drift Prisma would want to drop | **DIFFERS** |
| `ingredients.tags` | ADD COLUMN `TEXT[] NOT NULL DEFAULT '{}'` | `tags String[] @default([])` | **AGREES** |
| `ingredients.*` (data) | `UPDATE … SET unitClass = CASE … WHERE TRUE` — rewrites every row | Data-only; schema-neutral | n/a (replays on every deploy attempt) |
| `settings` (data) | Seeds `unit_base_weight`/`unit_base_volume`/`unit_base_count` rows (`mg`/`ml`/`pcs`) `ON CONFLICT DO NOTHING` | Data-only (Setting is a free key/value table) | n/a |

Replay outcome: fails on `CREATE TYPE "UnitClass"` (already exists) before
touching anything else.

**Why the DIFFERS rows matter:** the schema no longer declares what production
holds. If anyone "reconciles" by running `prisma db push` (or generates a diff
migration), Prisma will produce destructive DDL for exactly these three objects:
`DROP TYPE "UnitClass"`, `ALTER TABLE "ingredients" DROP COLUMN "unitClass"`
(destroying the backfilled data), and `DROP INDEX "ingredients_defaultSupplierId_idx"`.

## 4. `20260527000000_widen_costs_to_float`

The dangerous one for replay: every `ALTER COLUMN … TYPE` re-runs **successfully**
on columns that are already `DOUBLE PRECISION` (a no-op widening that still takes
an ACCESS EXCLUSIVE lock and rewrites the table). On a live production table this
is a lock/event stall risk even though no data changes. The final `UPDATE
"settings"` re-runs too (0 rows if the value is already `g`).

All five touched tables are DORMANT in the schema (models kept, code retired in
Slice 1) — but the columns are still declared, and with the widened types.

### Every column this migration ALTERs

| Table.column | Type before | Type after | Schema declares today | Verdict |
|---|---|---|---|---|
| `ingredients.averageUnitCost` | `INTEGER` | `DOUBLE PRECISION` | `unitCost Float @default(0) @map("averageUnitCost")` → DOUBLE PRECISION | **AGREES** |
| `ingredients.lastUnitCost` | `INTEGER` | `DOUBLE PRECISION` | `lastUnitCost Float?` → DOUBLE PRECISION | **AGREES** |
| `ingredient_purchases.unitCost` | `INTEGER` | `DOUBLE PRECISION` | `unitCost Float` → DOUBLE PRECISION | **AGREES** |
| `ingredient_purchases.avgUnitCostAfter` | `INTEGER` | `DOUBLE PRECISION` | `avgUnitCostAfter Float` → DOUBLE PRECISION | **AGREES** |
| `ingredient_logs.unitCost` | `INTEGER` | `DOUBLE PRECISION` | `unitCost Float` → DOUBLE PRECISION | **AGREES** |

The migration's header comment is the design intent still visible in the schema:
rupiah **totals** stay `INTEGER` on purpose (`IngredientPurchase.totalCost Int`,
`ExpenseItem.cost`); only per-base-unit costs were widened. The schema confirms
this split (`totalCost Int` beside `unitCost Float`).

Also in this migration (data-only): `UPDATE "settings" SET value = 'g' WHERE key
= 'unit_base_weight' AND value = 'mg'` — moves the WEIGHT base unit from mg to g,
with `scripts/repair-weight-to-g.mjs` rescaling existing rows. No schema
declaration involved.

---

## Summary

- 3 of the 4 unrecorded migrations agree with the schema everywhere except where
  noted; all 5 `widen_costs_to_float` ALTERs agree with the declared `Float` fields.
- **Drift (schema no longer declares what production holds):**
  1. `UnitClass` enum
  2. `ingredients.unitClass` column (with backfilled data)
  3. `ingredients_defaultSupplierId_idx` index
  All three come from `add_unit_class_and_ingredient_extras`; all three would be
  **dropped** by a schema→database reconciliation (`db push` / diff migration).
- The four migrations were applied to production but unrecorded, so `migrate
  deploy` would replay them: enum/table re-creates fail loudly mid-way,
  the widening ALTERs silently re-run (lock risk), and both data UPDATEs re-execute.

## For the live comparison step

1. Confirm which 4 migrations `_prisma_migrations` actually records (and resolve
   the "4 of 8" count — the repo only accounts for 7 directories).
2. `\d ingredients` — verify `unitClass`, `tags`, `defaultSupplierId` + index exist
   as this audit assumes.
3. Verify the 5 widened columns are already `DOUBLE PRECISION` in production.
4. If production ever needs future migrations recorded, use
   `prisma migrate resolve --applied <name>` per migration — never `deploy`.

---

## Addendum, 2026-08-31 — drift found by running the chain

Building a database from the migration chain (the pglite test harness now
applies it in full) exposed drift beyond the four unrecorded migrations. These
objects exist in production and in `schema.prisma` but in **no migration file**,
so the chain cannot reproduce production:

| Object | In the chain | In schema.prisma / prod | Consequence |
|---|---|---|---|
| `PaymentMethod` (enum) | `CASH, DYNAMIC_QRIS, STATIC_QRIS` | `CASH, QRIS, SPLIT, PENDING` | A database built from the chain **cannot store a single modern payment**. |
| `online_settlements`, `settlement_items`, `settlement_deductions` | absent | full tables | The entire pencairan subsystem — money — is unrecorded. |
| `staff.username`, `staff.supabaseUserId`, `staff.salary` | absent | present (+2 unique indexes) | No Staff row can be read or written. |
| `table_sessions.externalOrderId`, `.customerPhone`, `.erasedAt` | absent | present | Online orders and cancelled sessions. |
| `table_sessions.ownerId` | `NOT NULL` | nullable | A session may outlive the staff row that opened it. |
| `order_items.splitGroup`, `.preparedAt`, `.servedAt`, `.cancelledAt` | absent | present | Split bills and the preparation trail. |
| `transactions.discountAmount`, `.splitGroup`, `.voidedById`, `.voidedAt`, `.voidReason`, `.cogs` | absent | present | Discounts, split bills and the void trail. |

`test/drift-shim.sql` recreates every one of them so the suite can run against a
faithful copy. It is **test-only** — it is not a migration and must never be
applied to production, which already has all of it.

What this changes about the earlier conclusion: the gap is not only that four
migrations went unrecorded. The recorded chain is an incomplete description of
production in its own right, so "reconcile the history" is a bigger job than
resolving four rows in `_prisma_migrations`. Any future attempt needs a
column-by-column dump of the live schema first — still impossible on this
machine (no `pg_dump`).
