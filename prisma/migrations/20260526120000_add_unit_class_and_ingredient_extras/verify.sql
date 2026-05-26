-- Verification queries for the unit-class migration.
-- Run after the migration to sanity-check the backfill.

-- 1) Every ingredient has a unitClass.
SELECT COUNT(*) AS missing_unit_class
FROM "ingredients"
WHERE "unitClass" IS NULL;
-- expect: 0

-- 2) Distribution of unitClass × baseUnit.
SELECT "unitClass", "baseUnit", COUNT(*) AS n
FROM "ingredients"
GROUP BY "unitClass", "baseUnit"
ORDER BY "unitClass", n DESC;

-- 3) Rows that fell back to COUNT but have a non-COUNT-looking baseUnit
--    (these are good candidates for manual review in admin UI).
SELECT id, name, "baseUnit", "unitClass"
FROM "ingredients"
WHERE "unitClass" = 'COUNT'
  AND LOWER(TRIM("baseUnit")) NOT IN
      ('pcs','pc','buah','btg','batang','lbr','lembar','biji','ekor','bks','sch','sachet','pack','dus','ikat','renteng')
ORDER BY name;

-- 4) Rows whose baseUnit is not the resolved smallest unit for their class
--    (these are "needs normalization" candidates — the admin list page shows a chip).
SELECT id, name, "baseUnit", "unitClass"
FROM "ingredients" i
JOIN (
  SELECT
    (SELECT COALESCE(value, 'mg')  FROM settings WHERE key = 'unit_base_weight') AS w,
    (SELECT COALESCE(value, 'ml')  FROM settings WHERE key = 'unit_base_volume') AS v,
    (SELECT COALESCE(value, 'pcs') FROM settings WHERE key = 'unit_base_count')  AS c
) s ON TRUE
WHERE
  ("unitClass" = 'WEIGHT' AND LOWER(TRIM("baseUnit")) <> LOWER(s.w))
  OR ("unitClass" = 'VOLUME' AND LOWER(TRIM("baseUnit")) <> LOWER(s.v))
  OR ("unitClass" = 'COUNT'  AND LOWER(TRIM("baseUnit")) <> LOWER(s.c))
ORDER BY "unitClass", name;

-- 5) Settings should now contain the three unit_base_* rows.
SELECT key, value FROM "settings" WHERE key LIKE 'unit_base_%' ORDER BY key;

-- 6) Defaults: no ingredient should already have defaultSupplierId set
--    (this column is brand-new).
SELECT COUNT(*) AS rows_with_supplier
FROM "ingredients"
WHERE "defaultSupplierId" IS NOT NULL;
-- expect: 0 (until you start populating)

-- 7) Tags column should default to empty array on every row.
SELECT COUNT(*) AS rows_with_tags
FROM "ingredients"
WHERE cardinality("tags") > 0;
-- expect: 0 immediately after migration
