"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireOwner } from "@/lib/admin-auth";
import { revalidateInventory } from "@/lib/revalidate";
import { runAction } from "@/lib/action-error";

// ─── Recipe ───────────────────────────────────────────────────────────────────

const RecipeSchema = z.object({
  notes: z.string().optional(),
});

/**
 * Upsert the recipe for a menuItem+variant combo.
 * variantId="" means null (base item, no variant).
 */
export async function upsertRecipe(
  menuItemId: string,
  variantId: string | null,
  formData: FormData
) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const parsed = RecipeSchema.parse({
      notes: formData.get("notes")?.toString() || undefined,
    });
    const vid = variantId || null;

    // Prisma nullable unique: use findFirst + create/update to avoid type issues
    const existing = await prisma.recipe.findFirst({
      where: { menuItemId, variantId: vid },
    });

    if (existing) {
      await prisma.recipe.update({
        where: { id: existing.id },
        data: { notes: parsed.notes ?? null },
      });
    } else {
      await prisma.recipe.create({
        data: { menuItemId, variantId: vid, notes: parsed.notes ?? null },
      });
    }
    revalidateInventory();
  });
}

export async function deleteRecipe(recipeId: string) {
  return runAction(async () => {
    await requireOwner();
    await prisma.recipe.delete({ where: { id: recipeId } });
    revalidateInventory();
  });
}

// ─── Recipe Ingredients ───────────────────────────────────────────────────────

const IngredientLineSchema = z.object({
  templateId: z.string().optional(),
  customName: z.string().min(1).optional(),
  customUnit: z.string().optional(),
  quantity: z.coerce.number().positive(),
});

export async function addRecipeIngredient(recipeId: string, formData: FormData) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const raw = {
      templateId: formData.get("templateId")?.toString() || undefined,
      customName: formData.get("customName")?.toString() || undefined,
      customUnit: formData.get("customUnit")?.toString() || undefined,
      quantity: formData.get("quantity"),
    };
    const parsed = IngredientLineSchema.parse(raw);

    if (!parsed.templateId && !parsed.customName) {
      throw new Error("Pilih bahan dari daftar atau masukkan nama bahan baru.");
    }

    await prisma.recipeIngredient.create({
      data: {
        recipeId,
        templateId: parsed.templateId || null,
        customName: parsed.customName || null,
        customUnit: parsed.customUnit || null,
        quantity: parsed.quantity,
      },
    });
    revalidateInventory();
  });
}

export async function updateRecipeIngredient(id: string, formData: FormData) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const quantity = z.coerce.number().positive().parse(formData.get("quantity"));
    await prisma.recipeIngredient.update({
      where: { id },
      data: { quantity },
    });
    revalidateInventory();
  });
}

export async function deleteRecipeIngredient(id: string) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    await prisma.recipeIngredient.delete({ where: { id } });
    revalidateInventory();
  });
}
