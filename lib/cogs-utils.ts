/**
 * COGS (Cost of Goods Sold) and inventory stock utilities.
 * Uses weighted moving average (WMA) cost stored on Ingredient.averageUnitCost.
 * All functions that write to the DB operate inside a Prisma interactive transaction.
 */

import { Prisma } from "@/generated/prisma";

export type PrismaTx = Prisma.TransactionClient;

// ─── Pack unit conversion ─────────────────────────────────────────────────────

/**
 * Resolve base quantity for a purchase given a pack label.
 * Looks up IngredientPack by (ingredientId, label).
 * Returns { baseQty, packBaseQty } where baseQty = packQty * packBaseQty.
 * Falls back to 1:1 if no pack found.
 */
export async function resolvePackQty(
  tx: PrismaTx,
  ingredientId: string,
  packLabel: string | null | undefined,
  packQty: number,
): Promise<{ baseQty: number; packBaseQty: number }> {
  if (!packLabel) return { baseQty: packQty, packBaseQty: 1 };
  const pack = await tx.ingredientPack.findUnique({
    where: { ingredientId_label: { ingredientId, label: packLabel } },
    select: { baseQty: true },
  });
  const packBaseQty = pack?.baseQty ?? 1;
  return { baseQty: packQty * packBaseQty, packBaseQty };
}

// ─── WMA cost read ────────────────────────────────────────────────────────────

/**
 * Returns the current weighted-average unit cost (Rp) for an ingredient.
 * O(1) — reads the denormalized field directly from the Ingredient row.
 */
export async function getIngredientAvgCost(
  tx: PrismaTx,
  ingredientId: string,
): Promise<number> {
  const row = await tx.ingredient.findUnique({
    where: { id: ingredientId },
    select: { averageUnitCost: true },
  });
  return row?.averageUnitCost ?? 0;
}

// ─── Purchase recording ───────────────────────────────────────────────────────

export interface PurchaseInput {
  ingredientId: string;
  supplierId?: string | null;
  expenseItemId?: string | null;
  source: "EXPENSE" | "ADJUSTMENT" | "OPNAME_GAIN";
  packLabel?: string | null;
  packQty: number;       // qty in pack unit (e.g. 2 if buying 2 dus)
  totalCost: number;     // total Rp paid for this line
  purchasedAt?: Date;
  recordedById?: string | null;
  notes?: string | null;
}

/**
 * Records a batch of ingredient purchases in a fixed number of DB round trips,
 * regardless of how many items are passed. Behaviour is identical to applying
 * the legacy per-item recordPurchase sequentially:
 * 1. Prefetches pack definitions and ingredient states (2 queries total).
 * 2. Folds the WMA per ingredient in memory, in input order, so repeated
 *    ingredients chain their average correctly.
 * 3. Inserts all IngredientPurchase + IngredientLog rows via createMany.
 * 4. Writes one Ingredient.update per distinct ingredient with final values.
 */
export async function recordPurchasesBatch(
  tx: PrismaTx,
  inputs: PurchaseInput[],
): Promise<void> {
  if (inputs.length === 0) return;

  const ingredientIds = [...new Set(inputs.map((i) => i.ingredientId))];

  const packs = await tx.ingredientPack.findMany({
    where: { ingredientId: { in: ingredientIds } },
    select: { ingredientId: true, label: true, baseQty: true },
  });
  const packMap = new Map<string, number>();
  for (const p of packs) packMap.set(`${p.ingredientId}::${p.label}`, p.baseQty);

  const ings = await tx.ingredient.findMany({
    where: { id: { in: ingredientIds } },
    select: { id: true, currentStock: true, averageUnitCost: true },
  });
  const state = new Map<
    string,
    { stock: number; avg: number; lastUnitCost: number; lastPurchasedAt: Date }
  >();
  for (const ing of ings) {
    state.set(ing.id, {
      stock: ing.currentStock,
      avg: ing.averageUnitCost,
      lastUnitCost: 0,
      lastPurchasedAt: new Date(0),
    });
  }
  for (const id of ingredientIds) {
    if (!state.has(id)) throw new Error("Bahan tidak ditemukan.");
  }

  const now = new Date();
  const purchaseRows: Prisma.IngredientPurchaseCreateManyInput[] = [];
  const logRows: Prisma.IngredientLogCreateManyInput[] = [];

  for (const input of inputs) {
    const { ingredientId, supplierId, expenseItemId, source, packLabel, packQty,
            totalCost, purchasedAt, recordedById, notes } = input;

    const packBaseQty = packLabel
      ? packMap.get(`${ingredientId}::${packLabel}`) ?? 1
      : 1;
    const baseQty = packQty * packBaseQty;
    const unitCost = baseQty > 0 ? Math.round(totalCost / baseQty) : 0;

    const s = state.get(ingredientId)!;
    const oldStock = s.stock;
    const oldAvg = s.avg;
    const newStock = oldStock + baseQty;
    const newAvg = newStock > 0
      ? Math.round((oldAvg * oldStock + totalCost) / newStock)
      : unitCost;

    const ts = purchasedAt ?? now;

    purchaseRows.push({
      ingredientId,
      supplierId:       supplierId ?? null,
      expenseItemId:    expenseItemId ?? null,
      source,
      packLabel:        packLabel ?? null,
      packQty,
      baseQty,
      totalCost,
      unitCost,
      avgUnitCostAfter: newAvg,
      stockAfter:       newStock,
      purchasedAt:      ts,
      recordedById:     recordedById ?? null,
      notes:            notes ?? null,
    });

    logRows.push({
      ingredientId,
      type:        "PURCHASE",
      quantity:    baseQty,
      unitCost,
      referenceId: expenseItemId ?? null,
      note:        notes ?? null,
    });

    s.stock = newStock;
    s.avg = newAvg;
    s.lastUnitCost = unitCost;
    s.lastPurchasedAt = ts;
  }

  await tx.ingredientPurchase.createMany({ data: purchaseRows });
  await tx.ingredientLog.createMany({ data: logRows });

  for (const id of ingredientIds) {
    const s = state.get(id)!;
    await tx.ingredient.update({
      where: { id },
      data: {
        currentStock:    s.stock,
        averageUnitCost: s.avg,
        lastUnitCost:    s.lastUnitCost,
        lastPurchasedAt: s.lastPurchasedAt,
      },
    });
  }
}

export interface ReversePurchaseInput {
  ingredientId: string;
  packLabel?: string | null;
  packQty: number;   // qty in pack unit, as stored on the expense item
  unitCost: number;
  note?: string | null;
}

/**
 * Reverses a batch of purchases (e.g. on expense edit/delete) in a fixed number
 * of round trips. Decrements stock by the resolved base quantity. WMA is NOT
 * recalculated backward to avoid distorting historical averages; only stock is
 * adjusted. Writes one ADJUSTMENT log per item.
 */
export async function reversePurchasesBatch(
  tx: PrismaTx,
  items: ReversePurchaseInput[],
): Promise<void> {
  if (items.length === 0) return;

  const ingredientIds = [...new Set(items.map((i) => i.ingredientId))];

  const packs = await tx.ingredientPack.findMany({
    where: { ingredientId: { in: ingredientIds } },
    select: { ingredientId: true, label: true, baseQty: true },
  });
  const packMap = new Map<string, number>();
  for (const p of packs) packMap.set(`${p.ingredientId}::${p.label}`, p.baseQty);

  const decrements = new Map<string, number>();
  const logRows: Prisma.IngredientLogCreateManyInput[] = [];

  for (const item of items) {
    const packBaseQty = item.packLabel
      ? packMap.get(`${item.ingredientId}::${item.packLabel}`) ?? 1
      : 1;
    const baseQty = item.packQty * packBaseQty;

    decrements.set(
      item.ingredientId,
      (decrements.get(item.ingredientId) ?? 0) + baseQty,
    );
    logRows.push({
      ingredientId: item.ingredientId,
      type:        "ADJUSTMENT",
      quantity:    -baseQty,
      unitCost:    item.unitCost,
      note:        item.note ?? "Purchase reversed",
    });
  }

  await tx.ingredientLog.createMany({ data: logRows });

  for (const [id, total] of decrements) {
    await tx.ingredient.update({
      where: { id },
      data: { currentStock: { decrement: total } },
    });
  }
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
 * of order items. Uses Ingredient.averageUnitCost (WMA) — O(1) per ingredient.
 * Skips CANCELLED items and recipe ingredients without an ingredientId.
 */
export async function computeOrderCogs(
  tx: PrismaTx,
  orderItems: OrderItemLike[],
): Promise<{ totalCogs: number; movements: StockMovement[] }> {
  const active = orderItems.filter((i) => i.status !== "CANCELLED");
  let totalCogs = 0;
  const movements: StockMovement[] = [];

  async function processRecipe(menuItemId: string, variantId: string | null, qty: number) {
    const recipe = await tx.recipe.findFirst({
      where: { menuItemId, variantId: variantId ?? null },
      include: { ingredients: true },
    });
    if (!recipe) return;

    for (const ing of recipe.ingredients) {
      // Support both new ingredientId and legacy templateId (same UUID during transition)
      const ingId = ing.ingredientId ?? ing.templateId;
      if (!ingId) continue;
      const avgCost = await getIngredientAvgCost(tx, ingId);
      const useQty = ing.quantity * qty;
      totalCogs += useQty * avgCost;
      movements.push({ ingredientId: ingId, quantity: -useQty, unitCost: avgCost });
    }
  }

  for (const item of active.filter((i) => i.menuItemId)) {
    await processRecipe(item.menuItemId!, item.variantId ?? null, item.qty);
  }

  for (const item of active.filter((i) => i.packageId)) {
    const members = await tx.packageItem.findMany({
      where: { packageId: item.packageId! },
      select: { menuItemId: true, variantId: true },
    });
    for (const m of members) {
      await processRecipe(m.menuItemId, m.variantId ?? null, item.qty);
    }
  }

  return { totalCogs: Math.round(totalCogs), movements };
}

// ─── Stock movements (SALE / WASTE / ADJUSTMENT) ──────────────────────────────

export interface StockMovement {
  ingredientId: string;
  quantity:     number; // positive = IN, negative = OUT
  unitCost:     number; // Rp per baseUnit
}

/**
 * Writes IngredientLog entries and updates Ingredient.currentStock for each
 * movement. Does NOT update WMA (WMA only changes on purchases).
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
 * Restores stock via ADJUSTMENT logs at the original unitCost.
 * Does NOT recalculate WMA.
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
 * Records ingredient waste. Decrements stock at current WMA cost.
 * Does NOT affect WMA.
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
 * If delta > 0 (gain), also records as OPNAME_GAIN IngredientPurchase at current WMA
 * so the purchase history is complete.
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

// ─── Legacy compatibility shim ────────────────────────────────────────────────
// Used by old code that may still reference templateId during the transition.
// Remove after migration 2 drops ExpenseTemplate.

/** @deprecated Use getIngredientAvgCost instead */
export async function getLatestIngredientCost(
  tx: PrismaTx,
  templateId: string,
): Promise<number> {
  return getIngredientAvgCost(tx, templateId);
}
