-- Additive migration: ingredient recipes (a material assembled from other
-- ingredients) + ASSEMBLY enum values. Safe for production — new tables and
-- new enum values only, no destructive changes.

-- AlterEnum
ALTER TYPE "IngredientPurchaseSource" ADD VALUE 'ASSEMBLY';

-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'ASSEMBLY';

-- CreateTable
CREATE TABLE "ingredient_recipes" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "yieldQty" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredient_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_recipe_items" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ingredient_recipe_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_recipes_ingredientId_key" ON "ingredient_recipes"("ingredientId");

-- AddForeignKey
ALTER TABLE "ingredient_recipes" ADD CONSTRAINT "ingredient_recipes_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_recipe_items" ADD CONSTRAINT "ingredient_recipe_items_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "ingredient_recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_recipe_items" ADD CONSTRAINT "ingredient_recipe_items_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
