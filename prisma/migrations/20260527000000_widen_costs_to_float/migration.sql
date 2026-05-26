-- Widen all per-base-unit cost fields from INTEGER (rupiah) to DOUBLE PRECISION (rupiah)
-- so cheap ingredients in small base units (e.g. arang at ~0.03 Rp/mg) no longer round to 0.
--
-- Rupiah TOTALS stay INTEGER on purpose: IngredientPurchase.totalCost, ExpenseItem.cost, etc.
-- are always whole rupiah, and keeping them as Int prevents drift in financial reports.
--
-- Per-row arithmetic (cogs-utils.recordPurchasesBatch) drops Math.round in the same change.
-- USING column::double precision is a safe lossless widening for existing Int data.

ALTER TABLE "ingredients"
  ALTER COLUMN "averageUnitCost" TYPE DOUBLE PRECISION USING "averageUnitCost"::double precision,
  ALTER COLUMN "lastUnitCost"    TYPE DOUBLE PRECISION USING "lastUnitCost"::double precision;

ALTER TABLE "ingredient_purchases"
  ALTER COLUMN "unitCost"         TYPE DOUBLE PRECISION USING "unitCost"::double precision,
  ALTER COLUMN "avgUnitCostAfter" TYPE DOUBLE PRECISION USING "avgUnitCostAfter"::double precision;

ALTER TABLE "ingredient_logs"
  ALTER COLUMN "unitCost" TYPE DOUBLE PRECISION USING "unitCost"::double precision;

-- Move the WEIGHT base unit from mg to g. mg is too small for our price ranges:
-- arang at ~30 Rp/kg = 0.03 Rp/mg loses precision and clutters the UI with huge
-- quantity numbers. g is the smallest practical unit. Existing WEIGHT ingredient
-- data is rescaled by the repair script (scripts/repair-weight-to-g.mjs).
UPDATE "settings" SET "value" = 'g' WHERE "key" = 'unit_base_weight' AND "value" = 'mg';
