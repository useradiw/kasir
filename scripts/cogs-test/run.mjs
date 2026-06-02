import dotenv from "dotenv";
dotenv.config({ path: ".env.claude.local" });
console.error("DB host:", (process.env.DATABASE_URL || "").match(/@([^/]*)/)?.[1]);

const { PrismaClient } = await import("../../generated/prisma/index.js");
const { PrismaPg } = await import("@prisma/adapter-pg");
const {
  recordPurchasesBatch,
  reverseExpenseItemPurchases,
  computeOrderCogs,
} = await import("../../lib/cogs-utils.ts");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ─── Assertion helper ─────────────────────────────────────────────────────────

function assert(condition, message) {
  if (!condition) throw new AssertionError(message);
}

class AssertionError extends Error {
  constructor(message) {
    super(message);
    this.name = "AssertionError";
  }
}

// ─── Test runner ──────────────────────────────────────────────────────────────

let failures = 0;
const ROLLBACK_SENTINEL = "ROLLBACK";

async function test(name, fn) {
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx);
      throw new Error(ROLLBACK_SENTINEL);
    });
    // If transaction committed without error, that's unexpected but still a pass
    console.log(`PASS  ${name}`);
  } catch (err) {
    if (err instanceof AssertionError) {
      console.error(`FAIL  ${name}`);
      console.error(`      Assertion: ${err.message}`);
      failures++;
    } else if (err && err.message === ROLLBACK_SENTINEL) {
      console.log(`PASS  ${name}`);
    } else {
      console.error(`FAIL  ${name}`);
      console.error(`      Error: ${err && err.message}`);
      failures++;
    }
  }
}

// ─── Test cases ───────────────────────────────────────────────────────────────

// 1. recordPurchasesBatch last-cost
await test("recordPurchasesBatch last-cost", async (tx) => {
  const uniqueSuffix = Date.now();
  const ing = await tx.ingredient.create({
    data: {
      name: `__test_${uniqueSuffix}`,
      baseUnit: "gr",
      currentStock: 0,
      averageUnitCost: 0,
    },
  });

  await recordPurchasesBatch(tx, [
    {
      ingredientId: ing.id,
      source: "EXPENSE",
      packLabel: null,
      packQty: 100,
      totalCost: 250000,
      purchasedAt: new Date(),
    },
  ]);

  const updated = await tx.ingredient.findUnique({ where: { id: ing.id } });
  assert(updated.currentStock === 100, `currentStock expected 100, got ${updated.currentStock}`);
  assert(
    updated.averageUnitCost === 2500,
    `averageUnitCost expected 2500, got ${updated.averageUnitCost}`,
  );

  const purchase = await tx.ingredientPurchase.findFirst({ where: { ingredientId: ing.id } });
  assert(purchase !== null, "IngredientPurchase row should exist");
  assert(purchase.baseQty === 100, `baseQty expected 100, got ${purchase.baseQty}`);
  assert(purchase.unitCost === 2500, `unitCost expected 2500, got ${purchase.unitCost}`);
});

// 2. Backdated purchase keeps latest cost
await test("backdated purchase keeps latest cost", async (tx) => {
  const uniqueSuffix = Date.now() + 1;
  const ing = await tx.ingredient.create({
    data: {
      name: `__test_${uniqueSuffix}`,
      baseUnit: "gr",
      currentStock: 0,
      averageUnitCost: 0,
    },
  });

  // First (more recent) purchase: 100 gr at 250000 total → unitCost 2500
  await recordPurchasesBatch(tx, [
    {
      ingredientId: ing.id,
      source: "EXPENSE",
      packLabel: null,
      packQty: 100,
      totalCost: 250000,
      purchasedAt: new Date(),
    },
  ]);

  // Second purchase: older date, 10 gr at 30000 total → unitCost 3000
  await recordPurchasesBatch(tx, [
    {
      ingredientId: ing.id,
      source: "EXPENSE",
      packLabel: null,
      packQty: 10,
      totalCost: 30000,
      purchasedAt: new Date("2020-01-01"),
    },
  ]);

  // recomputeLastCost picks the LATEST by purchasedAt — still 2500
  const updated = await tx.ingredient.findUnique({ where: { id: ing.id } });
  assert(
    updated.averageUnitCost === 2500,
    `averageUnitCost expected 2500 (latest cost), got ${updated.averageUnitCost}`,
  );
  assert(updated.currentStock === 110, `currentStock expected 110, got ${updated.currentStock}`);
});

// 3. reverseExpenseItemPurchases by stored baseQty
await test("reverseExpenseItemPurchases by stored baseQty", async (tx) => {
  const uniqueSuffix = Date.now() + 2;
  const ing = await tx.ingredient.create({
    data: {
      name: `__test_${uniqueSuffix}`,
      baseUnit: "pcs",
      currentStock: 0,
      averageUnitCost: 1000,
    },
  });

  // Create Expense + ExpenseItem
  const expense = await tx.expense.create({ data: {} });
  const expenseItem = await tx.expenseItem.create({
    data: {
      expenseId: expense.id,
      description: "Test item",
      amount: 2,
      cost: 1000,
      ingredientId: ing.id,
    },
  });

  // Create IngredientPurchase linked by expenseItemId, then bump stock
  const unitCost = 1000 / 120;
  await tx.ingredientPurchase.create({
    data: {
      ingredientId: ing.id,
      expenseItemId: expenseItem.id,
      source: "EXPENSE",
      packQty: 120,
      baseQty: 120,
      totalCost: 1000,
      unitCost,
      avgUnitCostAfter: unitCost,
      stockAfter: 120,
    },
  });
  await tx.ingredient.update({
    where: { id: ing.id },
    data: { currentStock: { increment: 120 } },
  });

  // Confirm stock is 120
  const before = await tx.ingredient.findUnique({ where: { id: ing.id } });
  assert(before.currentStock === 120, `pre-reversal stock expected 120, got ${before.currentStock}`);

  // Reverse
  await reverseExpenseItemPurchases(tx, [expenseItem.id]);

  // Stock should be back to 0
  const after = await tx.ingredient.findUnique({ where: { id: ing.id } });
  assert(after.currentStock === 0, `post-reversal stock expected 0, got ${after.currentStock}`);

  // IngredientPurchase row should be gone
  const count = await tx.ingredientPurchase.count({ where: { expenseItemId: expenseItem.id } });
  assert(count === 0, `IngredientPurchase count expected 0, got ${count}`);
});

// 4. computeOrderCogs
await test("computeOrderCogs", async (tx) => {
  const uniqueSuffix = Date.now() + 3;

  // Category
  const category = await tx.category.create({
    data: { name: `__test_cat_${uniqueSuffix}`, sortOrder: 0 },
  });

  // MenuItem
  const menuItem = await tx.menuItem.create({
    data: {
      name: `__test_menu_${uniqueSuffix}`,
      categoryId: category.id,
      price: 10000,
    },
  });

  // Ingredient
  const ing = await tx.ingredient.create({
    data: {
      name: `__test_${uniqueSuffix}`,
      baseUnit: "gr",
      currentStock: 100,
      averageUnitCost: 500,
    },
  });

  // Recipe with one RecipeIngredient (quantity 2)
  const recipe = await tx.recipe.create({
    data: { menuItemId: menuItem.id },
  });
  await tx.recipeIngredient.create({
    data: {
      recipeId: recipe.id,
      ingredientId: ing.id,
      quantity: 2,
    },
  });

  // Order: 3 of this menuItem, SERVED
  const { totalCogs, movements } = await computeOrderCogs(tx, [
    {
      menuItemId: menuItem.id,
      packageId: null,
      variantId: null,
      qty: 3,
      status: "SERVED",
    },
  ]);

  // Expected: 2 * 3 * 500 = 3000
  assert(totalCogs === 3000, `totalCogs expected 3000, got ${totalCogs}`);
  assert(movements.length === 1, `movements.length expected 1, got ${movements.length}`);
  assert(
    movements[0].quantity === -6,
    `movements[0].quantity expected -6, got ${movements[0].quantity}`,
  );
});

// ─── Teardown ─────────────────────────────────────────────────────────────────

await prisma.$disconnect();
process.exit(failures > 0 ? 1 : 0);
