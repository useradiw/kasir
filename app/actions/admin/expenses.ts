"use server";

import { revalidateExpenses } from "@/lib/revalidate";
import { prisma } from "@/lib/prisma";
import { requireOwnerStrict, requireRole } from "@/lib/admin-auth";
import { runAction } from "@/lib/action-error";
import { expenseSchema, type ExpenseData } from "@/lib/expense-schema";

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
              lineTotal:    i.total ?? Math.round(i.amount * i.cost),
              unit:         i.unit || null,
              templateId:   null,
              ingredientId: null,
            })),
          },
        },
        include: { items: true },
      });

      if (countToKasPakHar) {
        const total = parsed.items.reduce((s, i) => s + (i.total ?? i.amount * i.cost), 0);
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
    });

    revalidateExpenses();
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
      // Remove old kas pak har entries and items, then recreate
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
              lineTotal:    i.total ?? Math.round(i.amount * i.cost),
              unit:         i.unit || null,
              templateId:   null,
              ingredientId: null,
            })),
          },
        },
      });

      if (countToKasPakHar) {
        const total = parsed.items.reduce((s, i) => s + (i.total ?? i.amount * i.cost), 0);
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
    });

    revalidateExpenses();
  });
}

export async function deleteExpense(id: string) {
  return runAction(async () => {
    await requireOwnerStrict();

    await prisma.expense.delete({ where: { id } });

    revalidateExpenses();
  });
}
