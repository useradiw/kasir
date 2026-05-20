-- Migration 1: add_ingredient_model
-- Additive only — no existing tables or columns are dropped.
-- ExpenseTemplate stays alive; Ingredient is created with the same UUIDs.
-- After this migration runs, ingredientId mirrors templateId on all FK tables.

-- ─── 1. New enums ─────────────────────────────────────────────────────────────

CREATE TYPE "IngredientCategory" AS ENUM ('BAHAN', 'KEMASAN', 'PERLENGKAPAN', 'LAINNYA');
CREATE TYPE "IngredientPurchaseSource" AS ENUM ('EXPENSE', 'ADJUSTMENT', 'OPNAME_GAIN');

-- ─── 2. Suppliers ─────────────────────────────────────────────────────────────

CREATE TABLE "suppliers" (
    "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name"      TEXT NOT NULL,
    "phone"     TEXT,
    "notes"     TEXT,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- ─── 3. Ingredients (core new table) ──────────────────────────────────────────
-- We deliberately keep the same UUIDs as expense_templates so every existing FK
-- that points at expense_templates."id" can be mirrored to ingredients."id"
-- without any value change.

CREATE TABLE "ingredients" (
    "id"              TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "category"        "IngredientCategory" NOT NULL DEFAULT 'BAHAN',
    "baseUnit"        TEXT NOT NULL DEFAULT 'pcs',
    "currentStock"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageUnitCost" INTEGER NOT NULL DEFAULT 0,
    "lastUnitCost"    INTEGER,
    "lastPurchasedAt" TIMESTAMP(3),
    "lowStockAlert"   DOUBLE PRECISION,
    "isActive"        BOOLEAN NOT NULL DEFAULT true,
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ingredients_name_key" ON "ingredients"("name");

-- ─── 4. Backfill Ingredient from ExpenseTemplate (same UUIDs) ─────────────────

INSERT INTO "ingredients" (
    "id", "name", "baseUnit", "currentStock", "lowStockAlert",
    "isActive", "createdAt", "updatedAt"
)
SELECT
    et."id",
    et."name",
    COALESCE(et."defaultUnit", 'pcs'),
    et."currentStock",
    et."lowStockAlert",
    et."isActive",
    et."createdAt",
    CURRENT_TIMESTAMP
FROM "expense_templates" et
ON CONFLICT ("id") DO NOTHING;

-- ─── 5. Ingredient packs ──────────────────────────────────────────────────────

CREATE TABLE "ingredient_packs" (
    "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "ingredientId" TEXT NOT NULL,
    "label"        TEXT NOT NULL,
    "baseQty"      DOUBLE PRECISION NOT NULL,
    "isDefault"    BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ingredient_packs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ingredient_packs_ingredientId_label_key" ON "ingredient_packs"("ingredientId", "label");

ALTER TABLE "ingredient_packs"
    ADD CONSTRAINT "ingredient_packs_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE;

-- ─── 6. Ingredient purchases ──────────────────────────────────────────────────

CREATE TABLE "ingredient_purchases" (
    "id"               TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "ingredientId"     TEXT NOT NULL,
    "supplierId"       TEXT,
    "expenseItemId"    TEXT UNIQUE,
    "source"           "IngredientPurchaseSource" NOT NULL,
    "packLabel"        TEXT,
    "packQty"          DOUBLE PRECISION NOT NULL,
    "baseQty"          DOUBLE PRECISION NOT NULL,
    "totalCost"        INTEGER NOT NULL,
    "unitCost"         INTEGER NOT NULL,
    "avgUnitCostAfter" INTEGER NOT NULL,
    "stockAfter"       DOUBLE PRECISION NOT NULL,
    "purchasedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById"     TEXT,
    "notes"            TEXT,
    CONSTRAINT "ingredient_purchases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ingredient_purchases_ingredientId_purchasedAt_idx"
    ON "ingredient_purchases"("ingredientId", "purchasedAt");

ALTER TABLE "ingredient_purchases"
    ADD CONSTRAINT "ingredient_purchases_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id");

ALTER TABLE "ingredient_purchases"
    ADD CONSTRAINT "ingredient_purchases_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL;

ALTER TABLE "ingredient_purchases"
    ADD CONSTRAINT "ingredient_purchases_expenseItemId_fkey"
    FOREIGN KEY ("expenseItemId") REFERENCES "expense_items"("id") ON DELETE SET NULL;

-- ─── 7. Stock opnames ─────────────────────────────────────────────────────────

CREATE TABLE "stock_opnames" (
    "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "performedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedById" TEXT,
    "notes"         TEXT,
    CONSTRAINT "stock_opnames_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_opnames_performedAt_idx" ON "stock_opnames"("performedAt");

ALTER TABLE "stock_opnames"
    ADD CONSTRAINT "stock_opnames_performedById_fkey"
    FOREIGN KEY ("performedById") REFERENCES "staff"("id") ON DELETE SET NULL;

CREATE TABLE "stock_opname_lines" (
    "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "opnameId"     TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "systemQty"    DOUBLE PRECISION NOT NULL,
    "countedQty"   DOUBLE PRECISION NOT NULL,
    "delta"        DOUBLE PRECISION NOT NULL,
    "noteReason"   TEXT,
    CONSTRAINT "stock_opname_lines_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "stock_opname_lines"
    ADD CONSTRAINT "stock_opname_lines_opnameId_fkey"
    FOREIGN KEY ("opnameId") REFERENCES "stock_opnames"("id") ON DELETE CASCADE;

ALTER TABLE "stock_opname_lines"
    ADD CONSTRAINT "stock_opname_lines_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id");

-- ─── 8. Add supplierId to expenses ────────────────────────────────────────────

ALTER TABLE "expenses" ADD COLUMN "supplierId" TEXT;

ALTER TABLE "expenses"
    ADD CONSTRAINT "expenses_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL;

-- ─── 9. Add ingredientId to expense_items ─────────────────────────────────────

ALTER TABLE "expense_items" ADD COLUMN "ingredientId" TEXT;

ALTER TABLE "expense_items"
    ADD CONSTRAINT "expense_items_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE SET NULL;

-- Backfill: set ingredientId = templateId for all rows that have a templateId
-- This works because Ingredient UUIDs == ExpenseTemplate UUIDs
UPDATE "expense_items"
SET "ingredientId" = "templateId"
WHERE "templateId" IS NOT NULL;

-- ─── 10. Add ingredientId to recipe_ingredients ───────────────────────────────

ALTER TABLE "recipe_ingredients" ADD COLUMN "ingredientId" TEXT;

ALTER TABLE "recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE SET NULL;

UPDATE "recipe_ingredients"
SET "ingredientId" = "templateId"
WHERE "templateId" IS NOT NULL;

-- ─── 11. Add ingredientId to ingredient_logs, make templateId nullable ─────────

ALTER TABLE "ingredient_logs" ADD COLUMN "ingredientId" TEXT;

ALTER TABLE "ingredient_logs"
    ADD CONSTRAINT "ingredient_logs_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE;

-- Backfill ingredientId from templateId (same UUIDs)
UPDATE "ingredient_logs"
SET "ingredientId" = "templateId"
WHERE "templateId" IS NOT NULL;

-- Now make templateId nullable (it was NOT NULL before; Ingredient is the new authority)
ALTER TABLE "ingredient_logs" ALTER COLUMN "templateId" DROP NOT NULL;

-- Add index for new ingredientId column
CREATE INDEX "ingredient_logs_ingredientId_createdAt_idx"
    ON "ingredient_logs"("ingredientId", "createdAt");

-- ─── 12. Backfill IngredientPurchase from historical ExpenseItem records ───────
-- For each ExpenseItem with a templateId (= ingredientId), create an
-- IngredientPurchase row. We compute a running weighted-moving-average per
-- ingredient ordered by expense.recordedAt so avgUnitCostAfter is historically
-- accurate.

DO $$
DECLARE
    rec RECORD;
    running_stock DOUBLE PRECISION;
    running_avg   DOUBLE PRECISION;
    base_qty      DOUBLE PRECISION;
    unit_cost     INTEGER;
    total_cost    INTEGER;
    new_avg       DOUBLE PRECISION;
BEGIN
    -- Process each ingredient's expense items in chronological order
    FOR rec IN
        SELECT
            ei."id"          AS expense_item_id,
            ei."ingredientId",
            ei."amount",
            ei."cost",
            ei."unit"        AS pack_label,
            e."recordedAt"   AS purchased_at,
            e."staffId"      AS recorded_by_id,
            i."baseUnit"
        FROM "expense_items" ei
        JOIN "expenses" e ON ei."expenseId" = e."id"
        JOIN "ingredients" i ON i."id" = ei."ingredientId"
        WHERE ei."ingredientId" IS NOT NULL
          AND ei."amount" > 0
          AND ei."cost" >= 0
        ORDER BY ei."ingredientId", e."recordedAt" ASC, ei."id" ASC
    LOOP
        -- Get current running totals for this ingredient
        SELECT COALESCE(MAX(ip."stockAfter"), 0),
               COALESCE(MAX(ip."avgUnitCostAfter"), 0)
        INTO running_stock, running_avg
        FROM "ingredient_purchases" ip
        WHERE ip."ingredientId" = rec."ingredientId"
          AND ip."purchasedAt" <= rec."purchased_at";

        -- Simple unit conversion: if pack_label matches known patterns, convert
        -- For now we store packQty = amount and baseQty = amount (same unit assumed
        -- since defaultUnit was already stored as baseUnit). Pack conversion table
        -- didn't exist in old data.
        base_qty   := rec."amount";
        unit_cost  := rec."cost";
        total_cost := ROUND(base_qty * unit_cost);

        -- Weighted moving average
        IF (running_stock + base_qty) > 0 THEN
            new_avg := (running_avg * running_stock + total_cost) / (running_stock + base_qty);
        ELSE
            new_avg := unit_cost;
        END IF;

        INSERT INTO "ingredient_purchases" (
            "id", "ingredientId", "expenseItemId", "source",
            "packLabel", "packQty", "baseQty",
            "totalCost", "unitCost",
            "avgUnitCostAfter", "stockAfter",
            "purchasedAt", "recordedById"
        ) VALUES (
            gen_random_uuid()::text,
            rec."ingredientId",
            rec."expense_item_id",
            'EXPENSE',
            rec."pack_label",
            rec."amount",
            base_qty,
            total_cost,
            unit_cost,
            ROUND(new_avg)::integer,
            running_stock + base_qty,
            rec."purchased_at",
            rec."recorded_by_id"
        )
        ON CONFLICT ("expenseItemId") DO NOTHING;
    END LOOP;
END $$;

-- ─── 13. Update Ingredient WMA and last-purchase fields from backfilled data ───

UPDATE "ingredients" i
SET
    "averageUnitCost" = COALESCE(
        (SELECT ip."avgUnitCostAfter"
         FROM "ingredient_purchases" ip
         WHERE ip."ingredientId" = i."id"
         ORDER BY ip."purchasedAt" DESC, ip."id" DESC
         LIMIT 1),
        0
    ),
    "lastUnitCost" = (
        SELECT ip."unitCost"
        FROM "ingredient_purchases" ip
        WHERE ip."ingredientId" = i."id"
        ORDER BY ip."purchasedAt" DESC, ip."id" DESC
        LIMIT 1
    ),
    "lastPurchasedAt" = (
        SELECT ip."purchasedAt"
        FROM "ingredient_purchases" ip
        WHERE ip."ingredientId" = i."id"
        ORDER BY ip."purchasedAt" DESC, ip."id" DESC
        LIMIT 1
    );
