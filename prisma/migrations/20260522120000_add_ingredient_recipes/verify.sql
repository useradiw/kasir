-- Post-migration assertion: fails loudly if any expected schema element is missing.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='ingredient_recipes') THEN
    RAISE EXCEPTION 'ingredient_recipes table missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='ingredient_recipe_items') THEN
    RAISE EXCEPTION 'ingredient_recipe_items table missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid
                 WHERE t.typname='IngredientPurchaseSource' AND e.enumlabel='ASSEMBLY') THEN
    RAISE EXCEPTION 'IngredientPurchaseSource.ASSEMBLY missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid
                 WHERE t.typname='StockMovementType' AND e.enumlabel='ASSEMBLY') THEN
    RAISE EXCEPTION 'StockMovementType.ASSEMBLY missing';
  END IF;
END $$;
