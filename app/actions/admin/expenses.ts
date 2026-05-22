"use server";

import { revalidateExpenses, revalidateIngredients } from "@/lib/revalidate";
import { prisma } from "@/lib/prisma";
import { requireOwner, requireRole } from "@/lib/admin-auth";
import { z } from "zod";
import { runAction } from "@/lib/action-error";
import { recordPurchase, reversePurchase } from "@/lib/cogs-utils";

const expenseItemSchema = z.object({
  description:  z.string().min(1, "Deskripsi item harus diisi"),
  amount:       z.coerce.number().min(0.001, "Jumlah harus lebih dari 0"),
  cost:         z.coerce.number().int().min(0, "Biaya tidak boleh negatif"),
  unit:         z.string().optional(),
  templateId:   z.string().nullable().optional(), // legacy
  ingredientId: z.string().nullable().optional(),
});

const expenseSchema = z.object({
  description:      z.string().optional(),
  supplierId:       z.string().nullable().optional(),
  deductFromCash:   z.boolean().optional(),
  countToKasPakHar: z.boolean().optional(),
  items:            z.array(expenseItemSchema).min(1, "Minimal 1 item pengeluaran"),
});

type ExpenseData = {
  description?: string;
  supplierId?: string | null;
  deductFromCash?: boolean;
  countToKasPakHar?: boolean;
  items: {
    description: string;
    amount: number;
    cost: number;
    unit?: string;
    templateId?: string | null;
    ingredientId?: string | null;
  }[];
};

export async function addExpense(data: ExpenseData) {
  return runAction(async () => {
    const staff = await requireRole("OWNER", "MANAGER");
    const parsed = expenseSchema.parse(data);

    const deductFromCash   = parsed.deductFromCash ?? true;
    const countToKasPakHar = parsed.countToKasPakHar ?? false;

    if (deductFromCash && countToKasPakHar) {
      throw new Error("Tidak bisa mengurangi kas dan Kas Pak Har bersamaan");
    }

    await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          description:      parsed.description || null,
          supplierId:       parsed.supplierId ?? null,
          deductFromCash,
          countToKasPakHar,
          staffId:          staff.id,
          recordedAt:       new Date(),
          items: {
            create: parsed.items.map((i) => ({
              description:  i.description,
              amount:       i.amount,
              cost:         i.cost,
              unit:         i.unit || null,
              templateId:   null,
              ingredientId: i.ingredientId ?? null,
            })),
          },
        },
        include: { items: true },
      });

      if (countToKasPakHar) {
        const total = parsed.items.reduce((sum, i) => sum + i.amount * i.cost, 0);
        await tx.kasPakHar.create({
          data: {
            type:        "EXPENSE_DEDUCTION",
            amount:      total,
            description: parsed.description || null,
            expenseId:   expense.id,
            createdById: staff.id,
          },
        });
      }

      for (const item of expense.items) {
        const ingId = item.ingredientId;
        if (!ingId || item.amount <= 0) continue;
        await recordPurchase(tx, {
          ingredientId:  ingId,
          supplierId:    parsed.supplierId ?? null,
          expenseItemId: item.id,
          source:        "EXPENSE",
          packLabel:     item.unit,
          packQty:       item.amount,
          totalCost:     Math.round(item.amount * item.cost),
          purchasedAt:   expense.recordedAt,
          recordedById:  staff.id,
        });
      }
    });

    revalidateExpenses();
    revalidateIngredients();
  });
}

export async function updateExpense(id: string, data: ExpenseData) {
  return runAction(async () => {
    const staff = await requireRole("OWNER", "MANAGER");
    const parsed = expenseSchema.parse(data);

    const deductFromCash   = parsed.deductFromCash ?? true;
    const countToKasPakHar = parsed.countToKasPakHar ?? false;

    if (deductFromCash && countToKasPakHar) {
      throw new Error("Tidak bisa mengurangi kas dan Kas Pak Har bersamaan");
    }

    await prisma.$transaction(async (tx) => {
      // 1. Reverse stock for old ingredient-linked items
      const oldItems = await tx.expenseItem.findMany({
        where: { expenseId: id, ingredientId: { not: null } },
        select: { ingredientId: true, amount: true, cost: true, unit: true },
      });

      for (const old of oldItems) {
        if (!old.ingredientId) continue;
        // Resolve base qty for reversal (use stored unit as packLabel)
        const { baseQty } = await (await import("@/lib/cogs-utils")).resolvePackQty(
          tx, old.ingredientId, old.unit, old.amount
        );
        await reversePurchase(tx, old.ingredientId, baseQty, old.cost, "Expense edited");
      }

      // Also clean up linked IngredientPurchase rows
      const oldItemIds = await tx.expenseItem.findMany({
        where: { expenseId: id },
        select: { id: true },
      });
      await tx.ingredientPurchase.deleteMany({
        where: { expenseItemId: { in: oldItemIds.map((i) => i.id) } },
      });

      // 2. Remove old kas pak har entries and items, then recreate
      await tx.kasPakHar.deleteMany({ where: { expenseId: id } });
      await tx.expenseItem.deleteMany({ where: { expenseId: id } });

      await tx.expense.update({
        where: { id },
        data: {
          description:      parsed.description || null,
          supplierId:       parsed.supplierId ?? null,
          deductFromCash,
          countToKasPakHar,
          items: {
            create: parsed.items.map((i) => ({
              description:  i.description,
              amount:       i.amount,
              cost:         i.cost,
              unit:         i.unit || null,
              templateId:   null,
              ingredientId: i.ingredientId ?? null,
            })),
          },
        },
      });

      if (countToKasPakHar) {
        const total = parsed.items.reduce((sum, i) => sum + i.amount * i.cost, 0);
        await tx.kasPakHar.create({
          data: {
            type:        "EXPENSE_DEDUCTION",
            amount:      total,
            description: parsed.description || null,
            expenseId:   id,
            createdById: staff.id,
          },
        });
      }

      // 3. Stock IN for new items
      const newItems = await tx.expenseItem.findMany({
        where: { expenseId: id, ingredientId: { not: null } },
        select: { id: true, ingredientId: true, amount: true, cost: true, unit: true },
      });

      const expense = await tx.expense.findUniqueOrThrow({
        where: { id },
        select: { recordedAt: true, supplierId: true },
      });

      for (const item of newItems) {
        if (!item.ingredientId || item.amount <= 0) continue;
        await recordPurchase(tx, {
          ingredientId:  item.ingredientId,
          supplierId:    expense.supplierId,
          expenseItemId: item.id,
          source:        "EXPENSE",
          packLabel:     item.unit,
          packQty:       item.amount,
          totalCost:     Math.round(item.amount * item.cost),
          purchasedAt:   expense.recordedAt,
          recordedById:  staff.id,
        });
      }
    });

    revalidateExpenses();
    revalidateIngredients();
  });
}

export async function deleteExpense(id: string) {
  return runAction(async () => {
    await requireOwner();

    await prisma.$transaction(async (tx) => {
      // Reverse stock for ingredient-linked items
      const items = await tx.expenseItem.findMany({
        where: { expenseId: id, ingredientId: { not: null } },
        select: { ingredientId: true, amount: true, cost: true, unit: true },
      });

      for (const item of items) {
        if (!item.ingredientId) continue;
        const { baseQty } = await (await import("@/lib/cogs-utils")).resolvePackQty(
          tx, item.ingredientId, item.unit, item.amount
        );
        await reversePurchase(tx, item.ingredientId, baseQty, item.cost, "Expense deleted");
      }

      await tx.expense.delete({ where: { id } });
    });

    revalidateExpenses();
    revalidateIngredients();
  });
}
