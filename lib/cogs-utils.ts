/**
 * COGS (Cost of Goods Sold) and inventory stock utilities.
 *
 * All functions operate inside a Prisma interactive transaction (`PrismaTx`)
 * so they can be composed safely with other DB operations.
 */

import { Prisma } from "@/generated/prisma";

export type PrismaTx = Prisma.TransactionClient;

// ─── Unit conversion ─────────────────────────────────────────────────────────

/**
 * Predefined metric conversion factors.
 * Key: `${fromUnit}→${toUnit}`, value: multiplier.
 *
 * Rules:
 * - Weight base unit: gr  (kg = 1000 gr)
 * - Volume base unit: ml  (ltr = 1000 ml)
 * - All other units (pcs, btl, bks, dus, lbr, lbr) are 1:1 — no auto-conversion.
 *
 * Always convert purchase amounts → template's defaultUnit before updating stock.
 */
const CONVERSION: Record<string, number> = {
  "kg→gr": 1000,
  "gr→kg": 0.001,
  "ltr→ml": 1000,
  "ml→ltr": 0.001,
};

/**
 * Returns the factor to multiply `amount` in `fromUnit` to get the equivalent
 * in `toUnit`. Returns 1 when units are identical or no conversion is defined
 * (i.e., treat as compatible 1:1 units).
 */
export function getUnitConversionFactor(
  fromUnit: string | null | undefined,
  toUnit: string | null | undefined,
): number {
  if (!fromUnit || !toUnit || fromUnit === toUnit) return 1;
  return CONVERSION[`${fromUnit}→${toUnit}`] ?? 1;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StockMovement {
  templateId: string;
  quantity: number; // positive = stock IN, negative = stock OUT, in template's defaultUnit
  unitCost: number; // Rp per template's defaultUnit
}

// ─── Cost lookup ─────────────────────────────────────────────────────────────

/**
 * Returns the most recent unit purchase cost (Rp) for an ingredient template.
 * Falls back to 0 if no purchases have ever been recorded.
 */
export async function getLatestIngredientCost(
  tx: PrismaTx,
  templateId: string,
): Promise<number> {
  const latest = await tx.expenseItem.findFirst({
    where: { templateId },
    orderBy: { expense: { recordedAt: "desc" } },
    select: { cost: true },
  });
  return latest?.cost ?? 0;
}

// ─── COGS computation ─────────────────────────────────────────────────────────

export interface OrderItemLike {
  menuItemId: string | null | undefined;
  packageId: string | null | undefined;
  variantId: string | null | undefined;
  qty: number;
  status: string;
}

/**
 * Computes COGS (in Rp, rounded to integer) and per-ingredient stock movements
 * for a set of order items. Skips CANCELLED items and ingredients without a template.
 *
 * For menu items: looks up the Recipe for (menuItemId, variantId).
 * For packages:   sums the COGS of each member MenuItem's recipe.
 *
 * Returns `{ totalCogs, movements }`. If no recipes are configured, cogs = 0.
 */
export async function computeOrderCogs(
  tx: PrismaTx,
  orderItems: OrderItemLike[],
): Promise<{ totalCogs: number; movements: StockMovement[] }> {
  const active = orderItems.filter((i) => i.status !== "CANCELLED");
  let totalCogs = 0;
  const movements: StockMovement[] = [];

  // ── Direct menu items ────────────────────────────────────────────────────
  for (const item of active.filter((i) => i.menuItemId)) {
    // Use findFirst to handle nullable variantId in compound unique
    const recipe = await tx.recipe.findFirst({
      where: {
        menuItemId: item.menuItemId!,
        variantId: item.variantId ?? null,
      },
      include: { ingredients: true },
    });
    if (!recipe) continue;

    for (const ing of recipe.ingredients) {
      if (!ing.templateId) continue;
      const unitCost = await getLatestIngredientCost(tx, ing.templateId);
      const qty = ing.quantity * item.qty;
      totalCogs += qty * unitCost;
      movements.push({ templateId: ing.templateId, quantity: -qty, unitCost });
    }
  }

  // ── Package items — sum member MenuItem recipes ──────────────────────────
  for (const item of active.filter((i) => i.packageId)) {
    const members = await tx.packageItem.findMany({
      where: { packageId: item.packageId! },
      select: { menuItemId: true, variantId: true },
    });

    for (const member of members) {
      const recipe = await tx.recipe.findFirst({
        where: {
          menuItemId: member.menuItemId,
          variantId: member.variantId ?? null,
        },
        include: { ingredients: true },
      });
      if (!recipe) continue;

      for (const ing of recipe.ingredients) {
        if (!ing.templateId) continue;
        const unitCost = await getLatestIngredientCost(tx, ing.templateId);
        const qty = ing.quantity * item.qty;
        totalCogs += qty * unitCost;
        movements.push({ templateId: ing.templateId, quantity: -qty, unitCost });
      }
    }
  }

  return { totalCogs: Math.round(totalCogs), movements };
}

// ─── Stock application ────────────────────────────────────────────────────────

/**
 * Writes IngredientLog entries and updates ExpenseTemplate.currentStock for
 * each movement. Call this inside the same transaction as the triggering event.
 */
export async function applyStockMovements(
  tx: PrismaTx,
  movements: StockMovement[],
  type: "PURCHASE" | "SALE" | "ADJUSTMENT" | "WASTE",
  referenceId?: string | null,
  note?: string | null,
): Promise<void> {
  for (const m of movements) {
    await tx.ingredientLog.create({
      data: {
        templateId: m.templateId,
        type,
        quantity: m.quantity,
        unitCost: m.unitCost,
        referenceId: referenceId ?? null,
        note: note ?? null,
      },
    });

    // Update denormalized stock: always use increment/decrement to be safe
    // with concurrent operations.
    if (m.quantity >= 0) {
      await tx.expenseTemplate.update({
        where: { id: m.templateId },
        data: { currentStock: { increment: m.quantity } },
      });
    } else {
      await tx.expenseTemplate.update({
        where: { id: m.templateId },
        data: { currentStock: { decrement: -m.quantity } },
      });
    }
  }
}

/**
 * Reverses all SALE stock movements for a given transaction.
 * Creates ADJUSTMENT logs (positive quantity) for each original SALE log.
 * Call this when voiding a transaction.
 */
export async function reverseTransactionStock(
  tx: PrismaTx,
  transactionId: string,
): Promise<void> {
  const saleLogs = await tx.ingredientLog.findMany({
    where: { referenceId: transactionId, type: "SALE" },
    select: { templateId: true, quantity: true, unitCost: true },
  });

  for (const log of saleLogs) {
    // log.quantity is negative (stock OUT); reversal is positive
    const reversal = -log.quantity;
    await tx.ingredientLog.create({
      data: {
        templateId: log.templateId,
        type: "ADJUSTMENT",
        quantity: reversal,
        unitCost: log.unitCost,
        referenceId: transactionId,
        note: "Void reversal",
      },
    });
    await tx.expenseTemplate.update({
      where: { id: log.templateId },
      data: { currentStock: { increment: reversal } },
    });
  }
}
