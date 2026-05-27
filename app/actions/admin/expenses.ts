"use server";

import { revalidateExpenses, revalidateIngredients } from "@/lib/revalidate";
import { prisma } from "@/lib/prisma";
import { requireOwnerStrict, requireRole } from "@/lib/admin-auth";
import { runAction } from "@/lib/action-error";
import { expenseSchema, type ExpenseData } from "@/lib/expense-schema";
import { recordPurchasesBatch, reversePurchasesBatch } from "@/lib/cogs-utils";

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

      await recordPurchasesBatch(
        tx,
        expense.items
          .filter((item) => item.ingredientId && item.amount > 0)
          .map((item) => ({
            ingredientId:  item.ingredientId!,
            supplierId:    parsed.supplierId ?? null,
            expenseItemId: item.id,
            source:        "EXPENSE" as const,
            packLabel:     item.unit,
            packQty:       item.amount,
            totalCost:     Math.round(item.amount * item.cost),
            purchasedAt:   expense.recordedAt,
            recordedById:  staff.id,
          })),
      );
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

      await reversePurchasesBatch(
        tx,
        oldItems
          .filter((old) => old.ingredientId)
          .map((old) => ({
            ingredientId: old.ingredientId!,
            packLabel:    old.unit,
            packQty:      old.amount,
            unitCost:     old.cost,
            note:         "Expense edited",
          })),
      );

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

      await recordPurchasesBatch(
        tx,
        newItems
          .filter((item) => item.ingredientId && item.amount > 0)
          .map((item) => ({
            ingredientId:  item.ingredientId!,
            supplierId:    expense.supplierId,
            expenseItemId: item.id,
            source:        "EXPENSE" as const,
            packLabel:     item.unit,
            packQty:       item.amount,
            totalCost:     Math.round(item.amount * item.cost),
            purchasedAt:   expense.recordedAt,
            recordedById:  staff.id,
          })),
      );
    });

    revalidateExpenses();
    revalidateIngredients();
  });
}

export async function deleteExpense(id: string) {
  return runAction(async () => {
    await requireOwnerStrict();

    await prisma.$transaction(async (tx) => {
      // Reverse stock for ingredient-linked items
      const items = await tx.expenseItem.findMany({
        where: { expenseId: id, ingredientId: { not: null } },
        select: { ingredientId: true, amount: true, cost: true, unit: true },
      });

      await reversePurchasesBatch(
        tx,
        items
          .filter((item) => item.ingredientId)
          .map((item) => ({
            ingredientId: item.ingredientId!,
            packLabel:    item.unit,
            packQty:      item.amount,
            unitCost:     item.cost,
            note:         "Expense deleted",
          })),
      );

      await tx.expense.delete({ where: { id } });
    });

    revalidateExpenses();
    revalidateIngredients();
  });
}
