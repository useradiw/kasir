"use server";

import { revalidatePath } from "next/cache";
import { revalidateExpenses, revalidateCashRegister, revalidateIngredients } from "@/lib/revalidate";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";
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

export async function addExpenseForStaff(data: {
  description?: string;
  deductFromCash?: boolean;
  countToKasPakHar?: boolean;
  items: { description: string; amount: number; cost: number; unit?: string; templateId?: string | null }[];
}) {
  return runAction(async () => {
    const staff = await requireRole("OWNER", "MANAGER", "CASHIER");
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
          staffId: staff.id,
          deductFromCash,
          countToKasPakHar,
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

      // Stock IN: apply ingredient stock for items linked to a template.
      // Fetch template.defaultUnit to handle unit conversion (e.g., purchase in kg, stock in gr).
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

    revalidatePath("/expenses");
    revalidateExpenses();
    revalidateCashRegister();
    revalidateIngredients();
  });
}
