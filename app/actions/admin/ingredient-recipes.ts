"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";
import { revalidateIngredients } from "@/lib/revalidate";
import { runAction } from "@/lib/action-error";

const recipeSchema = z.object({
  yieldQty: z.coerce.number().positive("Hasil produksi harus lebih dari 0"),
  notes:    z.string().optional(),
});

export async function upsertIngredientRecipe(
  ingredientId: string,
  data: { yieldQty: number; notes?: string },
) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const parsed = recipeSchema.parse(data);
    const recipe = await prisma.ingredientRecipe.upsert({
      where:  { ingredientId },
      create: { ingredientId, yieldQty: parsed.yieldQty, notes: parsed.notes || null },
      update: { yieldQty: parsed.yieldQty, notes: parsed.notes || null },
    });
    revalidateIngredients();
    return recipe.id;
  });
}

export async function deleteIngredientRecipe(ingredientId: string) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    await prisma.ingredientRecipe.deleteMany({ where: { ingredientId } });
    revalidateIngredients();
  });
}

const itemSchema = z.object({
  ingredientId: z.string().min(1, "Pilih bahan komponen"),
  quantity:     z.coerce.number().positive("Jumlah harus lebih dari 0"),
});

export async function addIngredientRecipeItem(
  recipeId: string,
  data: { ingredientId: string; quantity: number },
) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const parsed = itemSchema.parse(data);
    const recipe = await prisma.ingredientRecipe.findUniqueOrThrow({
      where:  { id: recipeId },
      select: { ingredientId: true },
    });
    if (recipe.ingredientId === parsed.ingredientId) {
      throw new Error("Bahan tidak boleh memakai dirinya sendiri sebagai komponen.");
    }
    await prisma.ingredientRecipeItem.create({
      data: { recipeId, ingredientId: parsed.ingredientId, quantity: parsed.quantity },
    });
    revalidateIngredients();
  });
}

export async function updateIngredientRecipeItem(id: string, quantity: number) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const qty = z.coerce.number().positive("Jumlah harus lebih dari 0").parse(quantity);
    await prisma.ingredientRecipeItem.update({ where: { id }, data: { quantity: qty } });
    revalidateIngredients();
  });
}

export async function deleteIngredientRecipeItem(id: string) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    await prisma.ingredientRecipeItem.delete({ where: { id } });
    revalidateIngredients();
  });
}

/**
 * Production run: consumes the recipe's component stock and produces `batches`
 * worth of the parent material, recomputing its WMA cost.
 */
export async function assembleIngredient(
  ingredientId: string,
  batches: number,
  date?: string,
) {
  return runAction(async () => {
    const staff = await requireRole("OWNER", "MANAGER");
    const n = Number(batches);
    if (!Number.isFinite(n) || n <= 0) throw new Error("Jumlah batch harus lebih dari 0.");
    const purchasedAt = date ? new Date(date) : new Date();

    await prisma.$transaction(async (tx) => {
      const recipe = await tx.ingredientRecipe.findUnique({
        where:   { ingredientId },
        include: {
          items: {
            include: {
              ingredient: { select: { id: true, name: true, averageUnitCost: true } },
            },
          },
        },
      });
      if (!recipe) throw new Error("Bahan ini belum punya resep.");
      if (recipe.items.length === 0) throw new Error("Resep belum punya komponen.");

      const producedQty = recipe.yieldQty * n;
      const runId = crypto.randomUUID();
      let totalCost = 0;

      // ── consume components ──
      for (const item of recipe.items) {
        const consumed = item.quantity * n;
        const comp     = item.ingredient;
        totalCost += consumed * comp.averageUnitCost;
        await tx.ingredientLog.create({
          data: {
            ingredientId: comp.id,
            type:         "ASSEMBLY",
            quantity:     -consumed,
            unitCost:     comp.averageUnitCost,
            referenceId:  runId,
            note:         `Dipakai untuk produksi ${n} batch`,
          },
        });
        await tx.ingredient.update({
          where: { id: comp.id },
          data:  { currentStock: { decrement: consumed } },
        });
      }
      totalCost = Math.round(totalCost);

      // ── produce material (WMA on the parent) ──
      const produced = await tx.ingredient.findUniqueOrThrow({
        where:  { id: ingredientId },
        select: { currentStock: true, averageUnitCost: true },
      });
      const newStock = produced.currentStock + producedQty;
      const unitCost = producedQty > 0 ? Math.round(totalCost / producedQty) : 0;
      const newAvg   = newStock > 0
        ? Math.round((produced.averageUnitCost * produced.currentStock + totalCost) / newStock)
        : unitCost;

      await tx.ingredientPurchase.create({
        data: {
          ingredientId,
          source:           "ASSEMBLY",
          packLabel:        null,
          packQty:          producedQty,
          baseQty:          producedQty,
          totalCost,
          unitCost,
          avgUnitCostAfter: newAvg,
          stockAfter:       newStock,
          purchasedAt,
          recordedById:     staff.id,
          notes:            `Produksi ${n} batch`,
        },
      });
      await tx.ingredientLog.create({
        data: {
          ingredientId,
          type:        "ASSEMBLY",
          quantity:    producedQty,
          unitCost,
          referenceId: runId,
          note:        `Produksi ${n} batch`,
        },
      });
      await tx.ingredient.update({
        where: { id: ingredientId },
        data:  {
          currentStock:    newStock,
          averageUnitCost: newAvg,
          lastUnitCost:    unitCost,
          lastPurchasedAt: purchasedAt,
        },
      });
    });
    revalidateIngredients();
  });
}
