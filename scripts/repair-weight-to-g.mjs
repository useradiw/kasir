// Rescale all WEIGHT ingredients so their base unit is "g".
//
// Why: switching the WEIGHT class base from mg → g (see migration
// 20260527000000_widen_costs_to_float and lib/unit-class.ts). Existing rows
// store stock/cost in whatever free-form baseUnit each ingredient was created
// with — usually "kg", sometimes "g" / "gr", and Arang at "mg". This script
// normalises everything to "g" and rescales the dependent numeric fields so
// reports and recipes keep computing the same rupiah totals.
//
// Conversion (scale = base-units-per-g of the OLD unit):
//   "kg"           → scale 1000   ; quantities ×1000, per-unit cost ÷1000
//   "g" / "gr"     → scale 1      ; no change
//   "mg"           → scale 0.001  ; quantities ÷1000, per-unit cost ×1000
//   anything else  → skip, print warning
//
// Special case: Arang. Its 38 historical EXPENSE purchase rows are legitimate
// intent (user really did buy N bks of arang at Rp X), they just got stored
// before the pack-conversion path existed and with mismatched packLabels that
// later fell through the silent 1:1 fallback. We REPLAY those rows with the
// proper pack=bks/3300g instead of scaling them — same approach we'd use to
// import the data fresh today.
//
// Run dry by default. Add --apply to write.
//   node scripts/repair-weight-to-g.mjs              # dry run
//   node scripts/repair-weight-to-g.mjs --apply      # commit inside one txn
//
// IMPORTANT: apply migration 20260527000000_widen_costs_to_float BEFORE
// running this — otherwise Float writes will fail on Int columns.

import { PrismaClient } from "../generated/prisma/client.js";

const ARANG_ID = "5eb5a074-9b94-4500-99ee-2f6f408c5c11";
const ARANG_PACK = { from: "1 bks", to: "bks", gramsPerPack: 3300 };

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

function scaleFor(unit) {
  const u = (unit || "").trim().toLowerCase();
  if (u === "kg")                                return 1000;
  if (u === "g" || u === "gr" || u === "gram")   return 1;
  if (u === "mg")                                return 0.001;
  return null;
}

async function planAndScaleStandard(tx, ing) {
  // Standard kg/g/mg rescale for non-Arang WEIGHT ingredients.
  const scale = scaleFor(ing.unit);
  if (scale === null) {
    console.warn(`  SKIP   ${ing.name.padEnd(25)} baseUnit="${ing.unit}" (unrecognised; fix manually)`);
    return false;
  }
  const note = scale === 1 ? "(no rescale)" : `× ${scale} qty, ÷ ${scale} cost`;
  console.log(`  PLAN   ${ing.name.padEnd(25)} ${ing.unit.padEnd(4)} → g   ${note}`);

  if (!apply) return true;

  await tx.ingredient.update({
    where: { id: ing.id },
    data: {
      unit:            "g",
      currentStock:    ing.currentStock * scale,
      unitCost:        ing.unitCost / scale,
      lastUnitCost:    ing.lastUnitCost == null ? null : ing.lastUnitCost / scale,
    },
  });

  const packs = await tx.ingredientPack.findMany({ where: { ingredientId: ing.id } });
  for (const p of packs) {
    await tx.ingredientPack.update({ where: { id: p.id }, data: { baseQty: p.baseQty * scale } });
  }

  const purchases = await tx.ingredientPurchase.findMany({ where: { ingredientId: ing.id } });
  for (const p of purchases) {
    await tx.ingredientPurchase.update({
      where: { id: p.id },
      data: {
        baseQty:          p.baseQty * scale,
        unitCost:         p.unitCost / scale,
        avgUnitCostAfter: p.avgUnitCostAfter / scale,
        stockAfter:       p.stockAfter * scale,
      },
    });
  }

  const logs = await tx.ingredientLog.findMany({ where: { ingredientId: ing.id } });
  for (const l of logs) {
    await tx.ingredientLog.update({
      where: { id: l.id },
      data: { quantity: l.quantity * scale, unitCost: l.unitCost / scale },
    });
  }

  const recipeRefs = await tx.recipeIngredient.findMany({ where: { ingredientId: ing.id } });
  for (const r of recipeRefs) {
    await tx.recipeIngredient.update({ where: { id: r.id }, data: { quantity: r.quantity * scale } });
  }

  const componentRefs = await tx.ingredientRecipeItem.findMany({ where: { ingredientId: ing.id } });
  for (const r of componentRefs) {
    await tx.ingredientRecipeItem.update({ where: { id: r.id }, data: { quantity: r.quantity * scale } });
  }

  return true;
}

async function replayArang(tx) {
  // Re-interpret 38 historical EXPENSE purchases through the corrected pack
  // (bks = 3300 g). Recompute baseQty / unitCost / running WMA / running stock
  // in date order. Drop the +9,900,000 mg manual log (was a workaround for the
  // silent-fallback bug). Keep "Set HPP manual" ADJUSTMENT as audit.
  const ing = await tx.ingredient.findUniqueOrThrow({ where: { id: ARANG_ID } });
  console.log(`\n  PLAN   ${ing.name.padEnd(25)} REPLAY (pack=bks → ${ARANG_PACK.gramsPerPack} g per pack)`);

  const purchases = await tx.ingredientPurchase.findMany({
    where:   { ingredientId: ARANG_ID },
    orderBy: { purchasedAt: "asc" },
  });
  const expenseRows = purchases.filter((p) => p.source === "EXPENSE");
  const adjustmentRows = purchases.filter((p) => p.source !== "EXPENSE");
  const totalBks = expenseRows.reduce((sum, p) => sum + p.packQty, 0);
  const totalCost = expenseRows.reduce((sum, p) => sum + p.totalCost, 0);
  console.log(`         ${expenseRows.length} EXPENSE rows · sum packQty=${totalBks} bks · totalCost=Rp${totalCost.toLocaleString("id-ID")}`);
  console.log(`         final stock = ${totalBks * ARANG_PACK.gramsPerPack} g (= ${(totalBks * ARANG_PACK.gramsPerPack / 1000).toFixed(1)} kg purchased lifetime — do opname to set real on-hand stock)`);
  console.log(`         final WMA   = ${totalBks > 0 ? (totalCost / (totalBks * ARANG_PACK.gramsPerPack)).toFixed(4) : 0} Rp/g`);
  console.log(`         ${adjustmentRows.length} ADJUSTMENT/OPNAME rows preserved as audit`);

  if (!apply) return;

  // 1. Rename/rescale pack to the form that matches what the expense form types.
  const oldPack = await tx.ingredientPack.findFirst({
    where: { ingredientId: ARANG_ID, label: ARANG_PACK.from },
  });
  if (oldPack) {
    const conflict = await tx.ingredientPack.findFirst({
      where: { ingredientId: ARANG_ID, label: ARANG_PACK.to, id: { not: oldPack.id } },
    });
    if (conflict) {
      throw new Error(`Arang already has a pack labeled "${ARANG_PACK.to}". Resolve manually before re-running.`);
    }
    await tx.ingredientPack.update({
      where: { id: oldPack.id },
      data:  { label: ARANG_PACK.to, baseQty: ARANG_PACK.gramsPerPack, isDefault: true },
    });
  } else {
    // Pack already renamed (idempotent re-run) or never existed — create it.
    await tx.ingredientPack.upsert({
      where:  { ingredientId_label: { ingredientId: ARANG_ID, label: ARANG_PACK.to } },
      update: { baseQty: ARANG_PACK.gramsPerPack, isDefault: true },
      create: { ingredientId: ARANG_ID, label: ARANG_PACK.to, baseQty: ARANG_PACK.gramsPerPack, isDefault: true },
    });
  }

  // 2. Replay EXPENSE rows in date order; normalise packLabel; rebuild WMA.
  let runningStock = 0;
  let runningAvg   = 0;
  let lastCost     = 0;

  for (const p of expenseRows) {
    const baseQty  = p.packQty * ARANG_PACK.gramsPerPack;
    const unitCost = baseQty > 0 ? p.totalCost / baseQty : 0;
    const newStock = runningStock + baseQty;
    const newAvg   = newStock > 0
      ? (runningAvg * runningStock + p.totalCost) / newStock
      : unitCost;

    await tx.ingredientPurchase.update({
      where: { id: p.id },
      data: {
        packLabel:        ARANG_PACK.to,
        baseQty,
        unitCost,
        avgUnitCostAfter: newAvg,
        stockAfter:       newStock,
      },
    });

    runningStock = newStock;
    runningAvg   = newAvg;
    lastCost     = unitCost;
  }

  // 3. ADJUSTMENT/OPNAME rows: update stockAfter/avgUnitCostAfter to the running
  //    state at their timestamp so the audit trail still tells a coherent story.
  //    Recompute by replaying ALL rows (EXPENSE + ADJUSTMENT) in date order:
  const allByDate = [...purchases].sort((a, b) => a.purchasedAt.getTime() - b.purchasedAt.getTime());
  runningStock = 0;
  runningAvg   = 0;
  for (const p of allByDate) {
    if (p.source === "EXPENSE") {
      runningStock += p.packQty * ARANG_PACK.gramsPerPack;
      // running avg already computed above; refetch
      const fresh = await tx.ingredientPurchase.findUnique({ where: { id: p.id } });
      runningAvg = fresh.avgUnitCostAfter;
    } else {
      // ADJUSTMENT (e.g. "Set HPP manual"): doesn't change stock or WMA here.
      // Snap its stockAfter/avgUnitCostAfter to the running values for clarity.
      await tx.ingredientPurchase.update({
        where: { id: p.id },
        data:  { stockAfter: runningStock, avgUnitCostAfter: runningAvg },
      });
    }
  }

  // 4. IngredientLog rewrite. PURCHASE logs tied to an expense are corrected
  //    via their matching IngredientPurchase row. Orphan PURCHASE logs (no
  //    referenceId — that's the +9.9M mg manual fix) get deleted.
  const logs = await tx.ingredientLog.findMany({
    where:   { ingredientId: ARANG_ID },
    orderBy: { createdAt: "asc" },
  });
  for (const log of logs) {
    if (log.type !== "PURCHASE") continue;
    if (!log.referenceId) {
      await tx.ingredientLog.delete({ where: { id: log.id } });
      continue;
    }
    const match = await tx.ingredientPurchase.findFirst({
      where: { ingredientId: ARANG_ID, expenseItemId: log.referenceId },
    });
    if (match) {
      await tx.ingredientLog.update({
        where: { id: log.id },
        data:  { quantity: match.baseQty, unitCost: match.unitCost },
      });
    }
  }

  // 5. Final state on Ingredient.
  await tx.ingredient.update({
    where: { id: ARANG_ID },
    data: {
      unit:            "g",
      currentStock:    runningStock,
      unitCost:        runningAvg,
      lastUnitCost:    lastCost,
    },
  });

  console.log(`         done. currentStock=${runningStock} g, avgCost=${runningAvg.toFixed(4)} Rp/g`);
  console.log(`         NEXT: do a stock opname on Arang to set the real on-hand grams.`);
}

async function main() {
  const host = (process.env.DATABASE_URL || "").match(/@([^:]+):/)?.[1] ?? "?";
  console.log(`DB host: ${host}`);
  console.log(`Mode:    ${apply ? "APPLY (will write)" : "DRY RUN"}\n`);

  const weight = await prisma.ingredient.findMany({
    where:   { unitClass: "WEIGHT" },
    select:  { id: true, name: true, unit: true, currentStock: true,
               unitCost: true, lastUnitCost: true },
    orderBy: { name: "asc" },
  });

  console.log(`Found ${weight.length} WEIGHT ingredients.\n`);

  await prisma.$transaction(async (tx) => {
    for (const ing of weight) {
      if (ing.id === ARANG_ID) {
        await replayArang(tx);
      } else {
        await planAndScaleStandard(tx, ing);
      }
    }

    if (!apply) {
      // Roll back the transaction by throwing a known marker.
      throw new Error("__DRY_RUN__");
    }
  }, { timeout: 120_000 }).catch((e) => {
    if (e.message === "__DRY_RUN__") {
      console.log("\nDry run — no changes written. Re-run with --apply to commit.");
    } else {
      throw e;
    }
  });

  if (apply) {
    console.log("\nDone. Verify with scripts/verify-unit-class.mjs and the admin UI.");
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
