"use server";

import { revalidatePath } from "next/cache";
import { revalidateExpenses, revalidateCashRegister, revalidateIngredients } from "@/lib/revalidate";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";
import { z } from "zod";
import { runAction } from "@/lib/action-error";
import { recordPurchase } from "@/lib/cogs-utils";

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

export async function addExpenseForStaff(data: {
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
}) {
  return runAction(async () => {
    const staff = await requireRole("OWNER", "MANAGER", "CASHIER");
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
          staffId:          staff.id,
          supplierId:       parsed.supplierId ?? null,
          deductFromCash,
          countToKasPakHar,
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

      // Stock IN via recordPurchase for items linked to an ingredient
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

    revalidatePath("/expenses");
    revalidateExpenses();
    revalidateCashRegister();
    revalidateIngredients();
  });
}
