/**
 * COGS (Cost of Goods Sold) and inventory stock utilities.
 *
 * Costing model: LAST PURCHASE COST. `Ingredient.unitCost` holds the unit
 * cost (Rp per unit) of the most recent purchase — there is no weighted moving
 * average and no chronological replay. Editing/deleting a purchase simply
 * recomputes the cost from whatever the latest remaining purchase is.
 *
 * Unit model: each ingredient has ONE free-text unit (`Ingredient.unit`).
 * Stock, recipe quantities and cost are all expressed in that unit. There is no
 * pack/unit-conversion layer — a purchase line's `packQty` IS the quantity in the
 * ingredient's unit (the user converts "2 dus" → "60 butir" themselves when
 * recording). `packLabel` is kept only as a free-text memory note.
 *
 * Legacy columns (`packLabel`, `packQty`/`baseQty`, `avgUnitCostAfter`,
 * `stockAfter`, `unitClass`, IngredientPack) are still populated/present so the
 * DB schema is untouched in this phase; they are dormant and slated for a later
 * destructive cleanup migration. See docs/cogs-redesign-plan.md.
 *
 * All functions that write to the DB operate inside a Prisma interactive transaction.
 */

import { Prisma } from "@/generated/prisma";

export type PrismaTx = Prisma.TransactionClient;

// ─── WMA cost read ────────────────────────────────────────────────────────────

/**
 * Returns the current unit cost (Rp) for an ingredient.
 * O(1) — reads the denormalized field directly from the Ingredient row.
 */
export async function getIngredientAvgCost(
  tx: PrismaTx,
  ingredientId: string,
): Promise<number> {
  const row = await tx.ingredient.findUnique({
    where: { id: ingredientId },
    select: { unitCost: true },
  });
  return row?.unitCost ?? 0;
}

/**
 * Recomputes an ingredient's unit cost from its LATEST purchase row (by
 * purchasedAt). This is the whole costing rule: cost = most recent purchase's
 * unitCost. Robust to backdated purchases (e.g. linking historical expenses) and
 * to deletions (falls back to the next-latest remaining purchase).
 *
 * If no purchase rows remain, the existing cost is left untouched (we don't zero
 * a previously-known cost just because every purchase was removed).
 */
export async function recomputeLastCost(
  tx: PrismaTx,
  ingredientId: string,
): Promise<void> {
  const latest = await tx.ingredientPurchase.findFirst({
    where:   { ingredientId },
    orderBy: [{ purchasedAt: "desc" }, { id: "desc" }],
    select:  { unitCost: true, purchasedAt: true },
  });
  if (!latest) return;
  await tx.ingredient.update({
    where: { id: ingredientId },
    data: {
      unitCost:        latest.unitCost,
      lastUnitCost:    latest.unitCost,
      lastPurchasedAt: latest.purchasedAt,
    },
  });
}

// ─── Purchase recording ───────────────────────────────────────────────────────

export interface PurchaseInput {
  ingredientId: string;
  supplierId?: string | null;
  expenseItemId?: string | null;
  source: "EXPENSE" | "ADJUSTMENT" | "OPNAME_GAIN";
  packLabel?: string | null;  // free-text memory note (e.g. "2 dus"); NOT resolved
  packQty: number;            // quantity in the ingredient's unit
  totalCost: number;          // total Rp paid for this line
  purchasedAt?: Date;
  recordedById?: string | null;
  notes?: string | null;
}

/**
 * Records a batch of ingredient purchases.
 * 1. Inserts all IngredientPurchase + IngredientLog rows.
 * 2. Increments each ingredient's stock by the purchased quantity.
 * 3. Sets each affected ingredient's cost to its latest purchase cost.
 *
 * No pack resolution, no weighted average. `packQty` is taken as the quantity in
 * the ingredient's unit directly. unitCost = totalCost / qty.
 */
export async function recordPurchasesBatch(
  tx: PrismaTx,
  inputs: PurchaseInput[],
): Promise<void> {
  if (inputs.length === 0) return;

  const ingredientIds = [...new Set(inputs.map((i) => i.ingredientId))];

  const ings = await tx.ingredient.findMany({
    where: { id: { in: ingredientIds } },
    select: { id: true, currentStock: true },
  });
  const stockState = new Map<string, number>();
  for (const ing of ings) stockState.set(ing.id, ing.currentStock);
  for (const id of ingredientIds) {
    if (!stockState.has(id)) throw new Error("Bahan tidak ditemukan.");
  }

  const now = new Date();
  const purchaseRows: Prisma.IngredientPurchaseCreateManyInput[] = [];
  const logRows: Prisma.IngredientLogCreateManyInput[] = [];

  for (const input of inputs) {
    const { ingredientId, supplierId, expenseItemId, source, packLabel, packQty,
            totalCost, purchasedAt, recordedById, notes } = input;

    const qty = packQty;
    const unitCost = qty > 0 ? totalCost / qty : 0;

    const oldStock = stockState.get(ingredientId)!;
    const newStock = oldStock + qty;
    stockState.set(ingredientId, newStock);

    const ts = purchasedAt ?? now;

    purchaseRows.push({
      ingredientId,
      supplierId:       supplierId ?? null,
      expenseItemId:    expenseItemId ?? null,
      source,
      packLabel:        packLabel ?? null,
      packQty:          qty,
      baseQty:          qty,
      totalCost,
      unitCost,
      avgUnitCostAfter: unitCost,  // legacy column: last cost, not an average
      stockAfter:       newStock,
      purchasedAt:      ts,
      recordedById:     recordedById ?? null,
      notes:            notes ?? null,
    });

    logRows.push({
      ingredientId,
      type:        "PURCHASE",
      quantity:    qty,
      unitCost,
      referenceId: expenseItemId ?? null,
      note:        notes ?? null,
    });
  }

  await tx.ingredientPurchase.createMany({ data: purchaseRows });
  await tx.ingredientLog.createMany({ data: logRows });

  for (const id of ingredientIds) {
    await tx.ingredient.update({
      where: { id },
      data:  { currentStock: stockState.get(id)! },
    });
    await recomputeLastCost(tx, id);
  }
}

/**
 * Reverses the stock effect of expense items by their ACTUAL linked
 * IngredientPurchase rows (uses the stored `baseQty`, so it's correct for both
 * pre-migration pack-expanded rows and new qty-in-unit rows), deletes those
 * purchase rows, writes one ADJUSTMENT log per ingredient, then re-derives cost.
 * Returns the affected ingredient ids.
 */
export async function reverseExpenseItemPurchases(
  tx: PrismaTx,
  expenseItemIds: string[],
  note = "Expense reversed",
): Promise<string[]> {
  if (expenseItemIds.length === 0) return [];

  const purchases = await tx.ingredientPurchase.findMany({
    where:  { expenseItemId: { in: expenseItemIds } },
    select: { id: true, ingredientId: true, baseQty: true, unitCost: true },
  });
  if (purchases.length === 0) return [];

  const perIngredient = new Map<string, number>();
  const logRows: Prisma.IngredientLogCreateManyInput[] = [];
  for (const p of purchases) {
    perIngredient.set(p.ingredientId, (perIngredient.get(p.ingredientId) ?? 0) + p.baseQty);
    logRows.push({
      ingredientId: p.ingredientId,
      type:        "ADJUSTMENT",
      quantity:    -p.baseQty,
      unitCost:    p.unitCost,
      note,
    });
  }

  await tx.ingredientLog.createMany({ data: logRows });
  await tx.ingredientPurchase.deleteMany({ where: { id: { in: purchases.map((p) => p.id) } } });

  for (const [id, total] of perIngredient) {
    await tx.ingredient.update({ where: { id }, data: { currentStock: { decrement: total } } });
    await recomputeLastCost(tx, id);
  }
  return [...perIngredient.keys()];
}

// ─── COGS computation ─────────────────────────────────────────────────────────

export interface OrderItemLike {
  menuItemId: string | null | undefined;
  packageId:  string | null | undefined;
  variantId:  string | null | undefined;
  qty:        number;
  status:     string;
}

/**
 * Computes COGS (Rp, rounded) and per-ingredient stock movements for a set
 * of order items. Uses Ingredient.unitCost (last purchase cost).
 * Skips CANCELLED items and recipe ingredients without an ingredientId.
 */
export async function computeOrderCogs(
  tx: PrismaTx,
  orderItems: OrderItemLike[],
): Promise<{ totalCogs: number; movements: StockMovement[] }> {
  const active = orderItems.filter((i) => i.status !== "CANCELLED");
  if (active.length === 0) return { totalCogs: 0, movements: [] };

  const directMenuItemIds = active
    .filter((i) => i.menuItemId)
    .map((i) => i.menuItemId!);

  const packageIds = [...new Set(active.filter((i) => i.packageId).map((i) => i.packageId!))];

  const packageMembers = packageIds.length > 0
    ? await tx.packageItem.findMany({
        where: { packageId: { in: packageIds } },
        select: { packageId: true, menuItemId: true, variantId: true },
      })
    : [];

  const packageMenuItemIds = packageMembers.map((m) => m.menuItemId);
  const allMenuItemIds = [...new Set([...directMenuItemIds, ...packageMenuItemIds])];

  const recipes = await tx.recipe.findMany({
    where: { menuItemId: { in: allMenuItemIds } },
    select: {
      menuItemId: true,
      variantId: true,
      ingredients: { select: { ingredientId: true, templateId: true, quantity: true } },
    },
  });

  const recipeMap = new Map<string, typeof recipes[0]["ingredients"]>();
  for (const r of recipes) {
    recipeMap.set(`${r.menuItemId}::${r.variantId ?? ""}`, r.ingredients);
  }

  const ingredientIds = new Set<string>();
  for (const r of recipes) {
    for (const ing of r.ingredients) {
      const ingId = ing.ingredientId ?? ing.templateId;
      if (ingId) ingredientIds.add(ingId);
    }
  }

  const costRows = ingredientIds.size > 0
    ? await tx.ingredient.findMany({
        where: { id: { in: [...ingredientIds] } },
        select: { id: true, unitCost: true },
      })
    : [];
  const costMap = new Map(costRows.map((r) => [r.id, r.unitCost]));

  let totalCogs = 0;
  const movements: StockMovement[] = [];

  function processRecipe(menuItemId: string, variantId: string | null, qty: number) {
    const key = `${menuItemId}::${variantId ?? ""}`;
    const ings = recipeMap.get(key);
    if (!ings) return;

    for (const ing of ings) {
      const ingId = ing.ingredientId ?? ing.templateId;
      if (!ingId) continue;
      const avgCost = costMap.get(ingId) ?? 0;
      const useQty = ing.quantity * qty;
      totalCogs += useQty * avgCost;
      movements.push({ ingredientId: ingId, quantity: -useQty, unitCost: avgCost });
    }
  }

  for (const item of active.filter((i) => i.menuItemId)) {
    processRecipe(item.menuItemId!, item.variantId ?? null, item.qty);
  }

  for (const item of active.filter((i) => i.packageId)) {
    const members = packageMembers.filter((m) => m.packageId === item.packageId);
    for (const m of members) {
      processRecipe(m.menuItemId, m.variantId ?? null, item.qty);
    }
  }

  return { totalCogs: Math.round(totalCogs), movements };
}

// ─── Stock movements (SALE / WASTE / ADJUSTMENT) ──────────────────────────────

export interface StockMovement {
  ingredientId: string;
  quantity:     number; // positive = IN, negative = OUT
  unitCost:     number; // Rp per unit
}

/**
 * Writes IngredientLog entries and updates Ingredient.currentStock for each
 * movement. Does NOT change unit cost (cost only changes on purchases).
 */
export async function applyStockMovements(
  tx: PrismaTx,
  movements: StockMovement[],
  type: "SALE" | "ADJUSTMENT" | "WASTE",
  referenceId?: string | null,
  note?: string | null,
): Promise<void> {
  if (movements.length === 0) return;

  await tx.ingredientLog.createMany({
    data: movements.map((m) => ({
      ingredientId: m.ingredientId,
      type,
      quantity:     m.quantity,
      unitCost:     m.unitCost,
      referenceId:  referenceId ?? null,
      note:         note ?? null,
    })),
  });

  const net = new Map<string, number>();
  for (const m of movements) {
    net.set(m.ingredientId, (net.get(m.ingredientId) ?? 0) + m.quantity);
  }
  for (const [id, delta] of net) {
    await tx.ingredient.update({
      where: { id },
      data:  { currentStock: { increment: delta } },
    });
  }
}

/**
 * Reverses all SALE stock movements for a given transaction (called on void).
 * Restores stock via ADJUSTMENT logs at the original unitCost. Does NOT change cost.
 */
export async function reverseTransactionStock(
  tx: PrismaTx,
  transactionId: string,
): Promise<void> {
  const saleLogs = await tx.ingredientLog.findMany({
    where: { referenceId: transactionId, type: "SALE" },
    select: { ingredientId: true, quantity: true, unitCost: true },
  });

  const valid = saleLogs.filter((l) => l.ingredientId);
  if (valid.length === 0) return;

  await tx.ingredientLog.createMany({
    data: valid.map((log) => ({
      ingredientId: log.ingredientId,
      type:         "ADJUSTMENT",
      quantity:     -log.quantity, // log.quantity is negative; reversal is positive
      unitCost:     log.unitCost,
      referenceId:  transactionId,
      note:         "Void reversal",
    })),
  });

  const net = new Map<string, number>();
  for (const log of valid) {
    net.set(log.ingredientId!, (net.get(log.ingredientId!) ?? 0) + -log.quantity);
  }
  for (const [id, delta] of net) {
    await tx.ingredient.update({
      where: { id },
      data:  { currentStock: { increment: delta } },
    });
  }
}

// ─── Waste recording ──────────────────────────────────────────────────────────

/**
 * Records ingredient waste. Decrements stock at current unit cost. Does NOT change cost.
 */
export async function recordWaste(
  tx: PrismaTx,
  ingredientId: string,
  quantity: number,
  reason?: string | null,
): Promise<void> {
  const avgCost = await getIngredientAvgCost(tx, ingredientId);

  await tx.ingredient.update({
    where: { id: ingredientId },
    data:  { currentStock: { decrement: quantity } },
  });

  await tx.ingredientLog.create({
    data: {
      ingredientId,
      type:        "WASTE",
      quantity:    -quantity,
      unitCost:    avgCost,
      note:        reason ?? null,
    },
  });
}

// ─── Opname line recording ────────────────────────────────────────────────────

/**
 * Applies a single opname line result.
 * Sets stock to the counted quantity and writes an ADJUSTMENT log for the delta.
 * If delta > 0 (gain), also records an OPNAME_GAIN IngredientPurchase at current
 * cost so the purchase history is complete. Cost is unchanged (gain at current cost).
 */
export async function recordOpnameLine(
  tx: PrismaTx,
  ingredientId: string,
  systemQty: number,
  countedQty: number,
  opnameId: string,
): Promise<void> {
  const delta = countedQty - systemQty;
  if (delta === 0) return;

  const avgCost = await getIngredientAvgCost(tx, ingredientId);

  await tx.ingredient.update({
    where: { id: ingredientId },
    data:  { currentStock: countedQty },
  });

  await tx.ingredientLog.create({
    data: {
      ingredientId,
      type:        "ADJUSTMENT",
      quantity:    delta,
      unitCost:    avgCost,
      referenceId: opnameId,
      note:        delta > 0 ? "Opname gain" : "Opname shrinkage",
    },
  });

  if (delta > 0) {
    const totalCost = Math.round(delta * avgCost);
    await tx.ingredientPurchase.create({
      data: {
        ingredientId,
        source:          "OPNAME_GAIN",
        packQty:         delta,
        baseQty:         delta,
        totalCost,
        unitCost:        avgCost,
        avgUnitCostAfter: avgCost,
        stockAfter:      countedQty,
        purchasedAt:     new Date(),
        notes:           "Opname gain",
      },
    });
  }
}
