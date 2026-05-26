-- ─────────────────────────────────────────────────────────────────────────────
-- ADDITIVE MIGRATION: UnitClass + Ingredient extras
--
-- 1. Adds enum UnitClass (WEIGHT / VOLUME / COUNT).
-- 2. Adds Ingredient.unitClass (default COUNT).
-- 3. Adds Ingredient.defaultSupplierId + FK (ON DELETE SET NULL).
-- 4. Adds Ingredient.tags (text[] default '{}').
-- 5. Backfills unitClass from existing baseUnit values using a CASE table.
-- 6. Seeds Setting rows for unit_base_weight/volume/count (mg/ml/pcs).
--
-- Safe to run on production: no destructive changes, no column drops, no
-- column renames, no FK changes on existing rows.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Enum
CREATE TYPE "UnitClass" AS ENUM ('WEIGHT', 'VOLUME', 'COUNT');

-- 2) Ingredient.unitClass (default COUNT, NOT NULL via default)
ALTER TABLE "ingredients"
  ADD COLUMN "unitClass" "UnitClass" NOT NULL DEFAULT 'COUNT';

-- 3) Ingredient.defaultSupplierId (nullable FK, ON DELETE SET NULL)
ALTER TABLE "ingredients"
  ADD COLUMN "defaultSupplierId" TEXT;

ALTER TABLE "ingredients"
  ADD CONSTRAINT "ingredients_defaultSupplierId_fkey"
  FOREIGN KEY ("defaultSupplierId") REFERENCES "suppliers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ingredients_defaultSupplierId_idx"
  ON "ingredients"("defaultSupplierId");

-- 4) Ingredient.tags (text array, default empty)
ALTER TABLE "ingredients"
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT '{}';

-- 5) Backfill unitClass from existing baseUnit (case-insensitive)
UPDATE "ingredients"
SET "unitClass" = CASE
    WHEN LOWER(TRIM("baseUnit")) IN ('mg', 'g', 'gr', 'gram', 'kg', 'ons')                                  THEN 'WEIGHT'::"UnitClass"
    WHEN LOWER(TRIM("baseUnit")) IN ('ml', 'cc', 'l', 'lt', 'ltr', 'liter')                                 THEN 'VOLUME'::"UnitClass"
    WHEN LOWER(TRIM("baseUnit")) IN ('pcs', 'pc', 'buah', 'btg', 'batang', 'lbr', 'lembar', 'biji', 'ekor', 'bks', 'sch', 'sachet', 'pack', 'dus', 'ikat', 'renteng')
                                                                                                            THEN 'COUNT'::"UnitClass"
    ELSE 'COUNT'::"UnitClass"
END
WHERE TRUE;

-- 6) Seed unit base unit settings (if not already present)
INSERT INTO "settings" ("key", "value", "updatedAt") VALUES
  ('unit_base_weight', 'mg',  NOW()),
  ('unit_base_volume', 'ml',  NOW()),
  ('unit_base_count',  'pcs', NOW())
ON CONFLICT ("key") DO NOTHING;
