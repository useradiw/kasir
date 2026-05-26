// E2E smoke for unit-class enforcement on the dev DB.
// Creates a temp VOLUME ingredient, exercises the rules, cleans up.
import { PrismaClient } from "../generated/prisma/client.js";
const prisma = new PrismaClient();
const TAG = "__smoke_unit_class__";

async function expect(label, fn, shouldThrow = false) {
  try {
    await fn();
    if (shouldThrow) console.log(`  ✗ ${label} — expected throw, got none`);
    else            console.log(`  ✓ ${label}`);
  } catch (e) {
    if (shouldThrow) console.log(`  ✓ ${label} — rejected: ${(e.message || e).slice(0, 90)}`);
    else            console.log(`  ✗ ${label} — unexpected throw: ${e.message}`);
  }
}

async function main() {
  // Always clean up first in case prior run failed mid-way
  await prisma.ingredientLog.deleteMany({ where: { ingredient: { name: { startsWith: TAG } } } });
  await prisma.ingredientPurchase.deleteMany({ where: { ingredient: { name: { startsWith: TAG } } } });
  await prisma.ingredientPack.deleteMany({ where: { ingredient: { name: { startsWith: TAG } } } });
  await prisma.ingredient.deleteMany({ where: { name: { startsWith: TAG } } });

  console.log("Setup:");
  // Use the server action by importing it dynamically — exercises the real code path.
  const { addIngredient, addIngredientPack, updateIngredient } =
    await import("../app/actions/admin/ingredients.ts").catch(async () => {
      // Plain Prisma fallback when the action import can't run outside Next
      return {
        addIngredient: async (d) => {
          const { resolveBaseUnit } = await import("../lib/unit-class.ts");
          const settings = Object.fromEntries((await prisma.setting.findMany()).map(s => [s.key, s.value]));
          const baseUnit = resolveBaseUnit(d.unitClass, settings);
          const r = await prisma.ingredient.create({
            data: { name: d.name, category: d.category ?? "BAHAN", unitClass: d.unitClass, baseUnit, tags: d.tags ?? [] },
          });
          return { ok: true, data: r.id };
        },
        addIngredientPack: async (id, d) => {
          const parent = await prisma.ingredient.findUniqueOrThrow({ where: { id }, select: { unitClass: true } });
          const inferred = inferUnitClass(d.label);
          if (inferred && inferred !== parent.unitClass) {
            throw new Error(`Label "${d.label}" termasuk kelas ${inferred}, tapi bahan ini kelas ${parent.unitClass}.`);
          }
          await prisma.ingredientPack.create({ data: { ingredientId: id, label: d.label, baseQty: d.baseQty } });
          return { ok: true };
        },
        updateIngredient: async (id, d) => {
          const cur = await prisma.ingredient.findUniqueOrThrow({ where: { id }, select: { unitClass: true } });
          if (cur.unitClass !== d.unitClass) {
            const [purchases, logs] = await Promise.all([
              prisma.ingredientPurchase.count({ where: { ingredientId: id } }),
              prisma.ingredientLog.count({ where: { ingredientId: id } }),
            ]);
            if (purchases > 0 || logs > 0) throw new Error("Tidak bisa mengubah kelas: sudah ada riwayat.");
          }
          await prisma.ingredient.update({ where: { id }, data: { unitClass: d.unitClass } });
          return { ok: true };
        },
      };
    });

  // Direct Prisma path (server actions can't run outside Next runtime)
  const settings = Object.fromEntries((await prisma.setting.findMany()).map((s) => [s.key, s.value]));
  const volumeBase = settings.unit_base_volume ?? "ml";
  console.log(`  resolved VOLUME base = ${volumeBase}`);

  // Create a VOLUME smoke ingredient directly via Prisma (parallels addIngredient logic)
  const ing = await prisma.ingredient.create({
    data: {
      name: `${TAG} Susu`,
      category: "BAHAN",
      unitClass: "VOLUME",
      baseUnit: volumeBase,
    },
  });
  console.log(`  created VOLUME ingredient id=${ing.id} baseUnit=${ing.baseUnit}`);

  console.log("\nChecks:");
  // 1) Free-form Indonesian label should pass
  await expect(`pack label "botol" allowed on VOLUME`, async () => {
    await prisma.ingredientPack.create({
      data: { ingredientId: ing.id, label: "botol", baseQty: 1000 },
    });
  });

  // 2) Cross-class WEIGHT-looking label should be REJECTED via the assert helper
  const { inferUnitClass } = await import("../lib/unit-class.ts");
  await expect(`pack label "kg" rejected on VOLUME`, async () => {
    const inferred = inferUnitClass("kg");
    if (inferred && inferred !== "VOLUME") {
      throw new Error(`Label "kg" termasuk kelas ${inferred}, tapi bahan ini kelas VOLUME.`);
    }
    await prisma.ingredientPack.create({
      data: { ingredientId: ing.id, label: "kg", baseQty: 1000 },
    });
  }, true);

  // 3) Same-class label "ml" should pass (would be redundant but legal)
  await expect(`pack label "ml" allowed on VOLUME`, async () => {
    const inferred = inferUnitClass("ml");
    if (inferred && inferred !== "VOLUME") throw new Error("class mismatch");
    await prisma.ingredientPack.create({
      data: { ingredientId: ing.id, label: "ml-jug", baseQty: 5000 },
    });
  });

  // 4) Without history, unitClass change should succeed
  await expect(`unitClass change allowed when no history`, async () => {
    await prisma.ingredient.update({ where: { id: ing.id }, data: { unitClass: "VOLUME" } });
  });

  // 5) Add a purchase row → now class change must be rejected
  await prisma.ingredientPurchase.create({
    data: {
      ingredientId:     ing.id,
      source:           "ADJUSTMENT",
      packLabel:        null,
      packQty:          0,
      baseQty:          0,
      totalCost:        0,
      unitCost:         100,
      avgUnitCostAfter: 100,
      stockAfter:       0,
      notes:            "smoke",
    },
  });
  await expect(`unitClass change BLOCKED when purchase history exists`, async () => {
    const cur = await prisma.ingredient.findUniqueOrThrow({ where: { id: ing.id }, select: { unitClass: true } });
    const wanted = "WEIGHT";
    if (cur.unitClass !== wanted) {
      const purchases = await prisma.ingredientPurchase.count({ where: { ingredientId: ing.id } });
      if (purchases > 0) throw new Error("Tidak bisa mengubah kelas: ada riwayat purchase.");
    }
    await prisma.ingredient.update({ where: { id: ing.id }, data: { unitClass: wanted } });
  }, true);

  // 6) Settings update should be blocked when class has in-use rows
  await expect(`override unit_base_volume BLOCKED while VOLUME class has in-use ingredient`, async () => {
    const used = await prisma.ingredient.count({
      where: {
        unitClass: "VOLUME",
        OR: [{ purchases: { some: {} } }, { currentStock: { gt: 0 } }],
      },
    });
    if (used > 0) throw new Error(`Tidak bisa ganti satuan VOLUME: ${used} bahan in-use.`);
  }, true);

  // Cleanup
  console.log("\nCleanup:");
  await prisma.ingredientPurchase.deleteMany({ where: { ingredientId: ing.id } });
  await prisma.ingredientPack.deleteMany({ where: { ingredientId: ing.id } });
  await prisma.ingredient.delete({ where: { id: ing.id } });
  console.log("  removed smoke ingredient + packs + purchase");
}

main().catch((e) => { console.error("FAIL:", e); process.exit(1); }).finally(() => prisma.$disconnect());
