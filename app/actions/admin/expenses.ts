"use server";

import { revalidateExpenses, revalidateIngredients } from "@/lib/revalidate";
import { prisma } from "@/lib/prisma";
import { requireOwner, requireRole } from "@/lib/admin-auth";
import { z } from "zod";
import { runAction } from "@/lib/action-error";
import { applyStockMovements, getUnitConversionFactor } from "@/lib/cogs-utils";

const expenseItemSchema = z.object({
  description: z.string().min(1, "Deskripsi item harus diisi"),
  amount: z.coerce.number().min(0.001, "Jumlah harus lebih dari 0"),
  cost: z.coerce.number().int().min(0, "Biaya tidak boleh negatif"),
  unit: z.string().optional(),
  templateId: z.string().nullable().optional(),
});

const expenseSchema = z.object({
  description: z.string().optional(),
  deductFromCash: z.boolean().optional(),
  countToKasPakHar: z.boolean().optional(),
  items: z.array(expenseItemSchema).min(1, "Minimal 1 item pengeluaran"),
});

export async function addExpense(data: {
  description?: string;
  deductFromCash?: boolean;
  countToKasPakHar?: boolean;
  items: { description: string; amount: number; cost: number; unit?: string; templateId?: string | null }[];
}) {
  return runAction(async () => {
    const staff = await requireRole("OWNER", "MANAGER");
    const parsed = expenseSchema.parse(data);

    const deductFromCash = parsed.deductFromCash ?? true;
    const countToKasPakHar = parsed.countToKasPakHar ?? false;

    if (deductFromCash && countToKasPakHar) {
      throw new Error("Tidak bisa mengurangi kas dan Kas Pak Har bersamaan");
    }

    await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          description: parsed.description || null,
          deductFromCash,
          countToKasPakHar,
          staffId: staff.id,
          recordedAt: new Date(),
          items: { create: parsed.items },
        },
      });

      if (countToKasPakHar) {
        const total = parsed.items.reduce((sum, i) => sum + i.amount * i.cost, 0);
        await tx.kasPakHar.create({
          data: {
            type: "EXPENSE_DEDUCTION",
            amount: total,
            description: parsed.description || null,
            expenseId: expense.id,
            createdById: staff.id,
          },
        });
      }

      // Stock IN: apply ingredient stock for items linked to a template
      const itemsWithTemplate = await tx.expenseItem.findMany({
        where: { expenseId: expense.id, templateId: { not: null } },
        select: {
          id: true, templateId: true, amount: true, cost: true, unit: true,
          template: { select: { defaultUnit: true } },
        },
      });
      await applyStockMovements(
        tx,
        itemsWithTemplate.map((i) => {
          const factor = getUnitConversionFactor(i.unit, i.template?.defaultUnit);
          return { templateId: i.templateId!, quantity: i.amount * factor, unitCost: i.cost };
        }),
        "PURCHASE",
        expense.id,
      );
    });

    revalidateExpenses();
    revalidateIngredients();
  });
}

export async function updateExpense(
  id: string,
  data: {
    description?: string;
    deductFromCash?: boolean;
    countToKasPakHar?: boolean;
    items: { description: string; amount: number; cost: number; unit?: string; templateId?: string | null }[];
  },
) {
  return runAction(async () => {
    const staff = await requireRole("OWNER", "MANAGER");
    const parsed = expenseSchema.parse(data);

    const deductFromCash = parsed.deductFromCash ?? true;
    const countToKasPakHar = parsed.countToKasPakHar ?? false;

    if (deductFromCash && countToKasPakHar) {
      throw new Error("Tidak bisa mengurangi kas dan Kas Pak Har bersamaan");
    }

    await prisma.$transaction(async (tx) => {
      // Reverse stock for old items before deleting them
      const oldItems = await tx.expenseItem.findMany({
        where: { expenseId: id, templateId: { not: null } },
        select: {
          templateId: true, amount: true, cost: true, unit: true,
          template: { select: { defaultUnit: true } },
        },
      });
      if (oldItems.length > 0) {
        await applyStockMovements(
          tx,
          oldItems.map((i) => {
            const factor = getUnitConversionFactor(i.unit, i.template?.defaultUnit);
            return { templateId: i.templateId!, quantity: -(i.amount * factor), unitCost: i.cost };
          }),
          "ADJUSTMENT",
          id,
          "Expense edited — reversing old purchase",
        );
      }

      // Remove old kas pak har entries and items, then recreate
      await tx.kasPakHar.deleteMany({ where: { expenseId: id } });
      await tx.expenseItem.deleteMany({ where: { expenseId: id } });
      await tx.expense.update({
        where: { id },
        data: {
          description: parsed.description || null,
          deductFromCash,
          countToKasPakHar,
          items: { create: parsed.items },
        },
      });

      if (countToKasPakHar) {
        const total = parsed.items.reduce((sum, i) => sum + i.amount * i.cost, 0);
        await tx.kasPakHar.create({
          data: {
            type: "EXPENSE_DEDUCTION",
            amount: total,
            description: parsed.description || null,
            expenseId: id,
            createdById: staff.id,
          },
        });
      }

      // Stock IN for new items
      const newItems = await tx.expenseItem.findMany({
        where: { expenseId: id, templateId: { not: null } },
        select: {
          id: true, templateId: true, amount: true, cost: true, unit: true,
          template: { select: { defaultUnit: true } },
        },
      });
      await applyStockMovements(
        tx,
        newItems.map((i) => {
          const factor = getUnitConversionFactor(i.unit, i.template?.defaultUnit);
          return { templateId: i.templateId!, quantity: i.amount * factor, unitCost: i.cost };
        }),
        "PURCHASE",
        id,
      );
    });

    revalidateExpenses();
    revalidateIngredients();
  });
}

export async function deleteExpense(id: string) {
  return runAction(async () => {
    await requireOwner();

    await prisma.$transaction(async (tx) => {
      // Reverse stock for items linked to a template before cascade delete
      const items = await tx.expenseItem.findMany({
        where: { expenseId: id, templateId: { not: null } },
        select: {
          templateId: true, amount: true, cost: true, unit: true,
          template: { select: { defaultUnit: true } },
        },
      });
      if (items.length > 0) {
        await applyStockMovements(
          tx,
          items.map((i) => {
            const factor = getUnitConversionFactor(i.unit, i.template?.defaultUnit);
            return { templateId: i.templateId!, quantity: -(i.amount * factor), unitCost: i.cost };
          }),
          "ADJUSTMENT",
          id,
          "Expense deleted — reversing purchase",
        );
      }
      await tx.expense.delete({ where: { id } });
    });

    revalidateExpenses();
    revalidateIngredients();
  });
}
