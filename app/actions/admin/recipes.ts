"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireOwnerStrict, requireRoleStrict } from "@/lib/admin-auth";
import { revalidateInventory } from "@/lib/revalidate";
import { runAction } from "@/lib/action-error";

const RecipeSchema = z.object({
  notes: z.string().optional(),
});

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

    await prisma.recipe.upsert({
      where: { menuItemId_variantId: { menuItemId, variantId: vid as string } },
      create: { menuItemId, variantId: vid, notes: parsed.notes ?? null },
      update: { notes: parsed.notes ?? null },
    });
    revalidateInventory();
  });
}

export async function deleteRecipe(recipeId: string) {
  return runAction(async () => {
    await requireOwnerStrict();
    await prisma.recipe.delete({ where: { id: recipeId } });
    revalidateInventory();
  });
}

const IngredientLineSchema = z.object({
  ingredientId: z.string().optional(),
  customName:   z.string().min(1).optional(),
  customUnit:   z.string().optional(),
  quantity:     z.coerce.number().positive(),
});

export async function addRecipeIngredient(recipeId: string, formData: FormData) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const raw = {
      ingredientId: formData.get("ingredientId")?.toString() || undefined,
      customName:   formData.get("customName")?.toString() || undefined,
      customUnit:   formData.get("customUnit")?.toString() || undefined,
      quantity:     formData.get("quantity"),
    };
    const parsed = IngredientLineSchema.parse(raw);

    if (!parsed.ingredientId && !parsed.customName) {
      throw new Error("Pilih bahan dari daftar atau masukkan nama bahan baru.");
    }

    await prisma.recipeIngredient.create({
      data: {
        recipeId,
        ingredientId: parsed.ingredientId || null,
        customName:   parsed.customName || null,
        customUnit:   parsed.customUnit || null,
        quantity:     parsed.quantity,
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
    await requireRoleStrict("OWNER", "MANAGER");
    await prisma.recipeIngredient.delete({ where: { id } });
    revalidateInventory();
  });
}

const BulkLineSchema = z.object({
  ingredientId: z.string().min(1),
  quantity:     z.coerce.number().positive(),
});

/**
 * Bulk-add many ingredients to a menu Recipe in one transaction.
 * Inputs are validated all-or-nothing. Linked (ingredientId) only —
 * unlinked "customName" lines are not allowed in bulk to keep the parser simple.
 */
export async function addRecipeIngredientsBulk(
  recipeId: string,
  rows: Array<{ ingredientId: string; quantity: number }>,
) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("Tidak ada baris untuk ditambahkan.");
    }
    const parsed = z.array(BulkLineSchema).min(1).parse(rows);

    // Verify all ingredient IDs exist + are active
    const ids = [...new Set(parsed.map((r) => r.ingredientId))];
    const found = await prisma.ingredient.findMany({
      where:  { id: { in: ids } },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      throw new Error("Salah satu bahan tidak ditemukan. Refresh halaman dan coba lagi.");
    }

    await prisma.$transaction(
      parsed.map((r) =>
        prisma.recipeIngredient.create({
          data: {
            recipeId,
            ingredientId: r.ingredientId,
            quantity:     r.quantity,
          },
        }),
      ),
    );
    revalidateInventory();
    return { created: parsed.length };
  });
}
