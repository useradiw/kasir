"use server";

import { revalidatePath } from "next/cache";
import { revalidateExpenses, revalidateCashRegister, revalidateIngredients } from "@/lib/revalidate";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";
import { runAction } from "@/lib/action-error";
import { expenseSchema } from "@/lib/expense-schema";
import { recordPurchasesBatch } from "@/lib/cogs-utils";

export async function addExpenseForStaff(data: {
  description?: string;
  supplierId?: string | null;
  deductFromCash?: boolean;
  countToKasPakHar?: boolean;
  items: {
    description: string;
    amount: number;
    cost: number;
    total?: number;
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
              lineTotal:    i.total ?? Math.round(i.amount * i.cost),
              unit:         i.unit || null,
              templateId:   null,
              ingredientId: i.ingredientId ?? null,
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

      // Stock IN for items linked to an ingredient
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
            totalCost:     item.lineTotal ?? Math.round(item.amount * item.cost),
            purchasedAt:   expense.recordedAt,
            recordedById:  staff.id,
          })),
      );
    });

    revalidatePath("/expenses");
    revalidateExpenses();
    revalidateCashRegister();
    revalidateIngredients();
  });
}
