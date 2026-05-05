"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOwner, requireRole } from "@/lib/admin-auth";
import { z } from "zod";

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
  const staff = await requireRole("OWNER", "MANAGER");

  const parsed = expenseSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const deductFromCash = parsed.data.deductFromCash ?? true;
  const countToKasPakHar = parsed.data.countToKasPakHar ?? false;

  if (deductFromCash && countToKasPakHar) {
    throw new Error("Tidak bisa mengurangi kas dan Kas Pak Har bersamaan");
  }

  const expense = await prisma.expense.create({
    data: {
      description: parsed.data.description || null,
      deductFromCash,
      countToKasPakHar,
      staffId: staff.id,
      recordedAt: new Date(),
      items: {
        create: parsed.data.items,
      },
    },
  });

  if (countToKasPakHar) {
    const total = parsed.data.items.reduce((sum, i) => sum + i.amount * i.cost, 0);
    await prisma.kasPakHar.create({
      data: {
        type: "EXPENSE_DEDUCTION",
        amount: total,
        description: parsed.data.description || null,
        expenseId: expense.id,
        createdById: staff.id,
      },
    });
  }

  revalidatePath("/admin/expenses");
  revalidatePath("/admin/kas-pak-har");
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
  const staff = await requireRole("OWNER", "MANAGER");

  const parsed = expenseSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const deductFromCash = parsed.data.deductFromCash ?? true;
  const countToKasPakHar = parsed.data.countToKasPakHar ?? false;

  if (deductFromCash && countToKasPakHar) {
    throw new Error("Tidak bisa mengurangi kas dan Kas Pak Har bersamaan");
  }

  // Remove old kas pak har entries for this expense
  await prisma.kasPakHar.deleteMany({ where: { expenseId: id } });

  await prisma.$transaction([
    prisma.expenseItem.deleteMany({ where: { expenseId: id } }),
    prisma.expense.update({
      where: { id },
      data: {
        description: parsed.data.description || null,
        deductFromCash,
        countToKasPakHar,
        items: {
          create: parsed.data.items,
        },
      },
    }),
  ]);

  if (countToKasPakHar) {
    const total = parsed.data.items.reduce((sum, i) => sum + i.amount * i.cost, 0);
    await prisma.kasPakHar.create({
      data: {
        type: "EXPENSE_DEDUCTION",
        amount: total,
        description: parsed.data.description || null,
        expenseId: id,
        createdById: staff.id,
      },
    });
  }

  revalidatePath("/admin/expenses");
  revalidatePath("/admin/kas-pak-har");
}

export async function deleteExpense(id: string) {
  await requireOwner();
  await prisma.expense.delete({ where: { id } });
  revalidatePath("/admin/expenses");
}
