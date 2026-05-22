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
 * Records a purchase of an ingredient:
 * 1. Resolves base quantity from pack definition (or 1:1 if no pack).
 * 2. Computes unitCost = round(totalCost / baseQty).
 * 3. Updates Ingredient WMA: newAvg = (oldAvg × oldStock + totalCost) / (oldStock + baseQty).
 * 4. Updates Ingredient.currentStock, lastUnitCost, lastPurchasedAt.
 * 5. Inserts IngredientPurchase row with snapshot fields.
 * 6. Inserts IngredientLog PURCHASE entry.
 */
export async function recordPurchase(
  tx: PrismaTx,
  input: PurchaseInput,
): Promise<void> {
  const { ingredientId, supplierId, expenseItemId, source, packLabel, packQty,
          totalCost, purchasedAt, recordedById, notes } = input;

  // Resolve base quantity
  const { baseQty } = await resolvePackQty(tx, ingredientId, packLabel, packQty);
  const unitCost = baseQty > 0 ? Math.round(totalCost / baseQty) : 0;

  // Fetch current ingredient state
  const ing = await tx.ingredient.findUniqueOrThrow({
    where: { id: ingredientId },
    select: { currentStock: true, averageUnitCost: true },
  });

  // Weighted moving average
  const oldStock = ing.currentStock;
  const oldAvg = ing.averageUnitCost;
  const newStock = oldStock + baseQty;
  const newAvg = newStock > 0
    ? Math.round((oldAvg * oldStock + totalCost) / newStock)
    : unitCost;

  const ts = purchasedAt ?? new Date();

  // Update ingredient denormalized fields
  await tx.ingredient.update({
    where: { id: ingredientId },
    data: {
      currentStock:    newStock,
      averageUnitCost: newAvg,
      lastUnitCost:    unitCost,
      lastPurchasedAt: ts,
    },
  });

  // Insert IngredientPurchase snapshot
  await tx.ingredientPurchase.create({
    data: {
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
    },
  });

  // IngredientLog entry
  await tx.ingredientLog.create({
    data: {
      ingredientId,
      type:        "PURCHASE",
      quantity:    baseQty,
      unitCost,
      referenceId: expenseItemId ?? null,
      note:        notes ?? null,
    },
  });
}

/**
 * Reverses a purchase (e.g. on expense edit/delete).
 * Decrements stock by baseQty. WMA is NOT recalculated backward to avoid
 * distorting historical averages; only stock is adjusted.
 * Writes an ADJUSTMENT log.
 */
export async function reversePurchase(
  tx: PrismaTx,
  ingredientId: string,
  baseQty: number,
  unitCost: number,
  referenceNote?: string,
): Promise<void> {
  await tx.ingredient.update({
    where: { id: ingredientId },
    data: { currentStock: { decrement: baseQty } },
  });

  await tx.ingredientLog.create({
    data: {
      ingredientId,
      type:        "ADJUSTMENT",
      quantity:    -baseQty,
      unitCost,
      note:        referenceNote ?? "Purchase reversed",
    },
  });
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
  for (const m of movements) {
    await tx.ingredientLog.create({
      data: {
        ingredientId: m.ingredientId,
        type,
        quantity:     m.quantity,
        unitCost:     m.unitCost,
        referenceId:  referenceId ?? null,
        note:         note ?? null,
      },
    });

    if (m.quantity >= 0) {
      await tx.ingredient.update({
        where: { id: m.ingredientId },
        data:  { currentStock: { increment: m.quantity } },
      });
    } else {
      await tx.ingredient.update({
        where: { id: m.ingredientId },
        data:  { currentStock: { decrement: -m.quantity } },
      });
    }
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

  for (const log of saleLogs) {
    if (!log.ingredientId) continue;
    const reversal = -log.quantity; // log.quantity is negative; reversal is positive
    await tx.ingredientLog.create({
      data: {
        ingredientId: log.ingredientId,
        type:         "ADJUSTMENT",
        quantity:     reversal,
        unitCost:     log.unitCost,
        referenceId:  transactionId,
        note:         "Void reversal",
      },
    });
    await tx.ingredient.update({
      where: { id: log.ingredientId },
      data:  { currentStock: { increment: reversal } },
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
