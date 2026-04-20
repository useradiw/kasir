"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOwner, requireRole } from "@/lib/admin-auth";
import { z } from "zod";

const expenseItemSchema = z.object({
  description: z.string().min(1, "Deskripsi item harus diisi"),
  amount: z.coerce.number().int().min(1, "Jumlah harus minimal 1"),
  cost: z.coerce.number().int().min(0, "Biaya tidak boleh negatif"),
});

const expenseSchema = z.object({
  description: z.string().optional(),
  deductFromCash: z.boolean().optional(),
  items: z.array(expenseItemSchema).min(1, "Minimal 1 item pengeluaran"),
});

export async function addExpense(data: {
  description?: string;
  deductFromCash?: boolean;
  items: { description: string; amount: number; cost: number }[];
}) {
  const staff = await requireRole("OWNER", "MANAGER");

  const parsed = expenseSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  await prisma.expense.create({
    data: {
      description: parsed.data.description || null,
      deductFromCash: parsed.data.deductFromCash ?? true,
      staffId: staff.id,
      recordedAt: new Date(),
      items: {
        create: parsed.data.items,
      },
    },
  });
  revalidatePath("/admin/expenses");
}

export async function updateExpense(
  id: string,
  data: {
    description?: string;
    deductFromCash?: boolean;
    items: { description: string; amount: number; cost: number }[];
  },
) {
  await requireRole("OWNER", "MANAGER");

  const parsed = expenseSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  await prisma.$transaction([
    prisma.expenseItem.deleteMany({ where: { expenseId: id } }),
    prisma.expense.update({
      where: { id },
      data: {
        description: parsed.data.description || null,
        deductFromCash: parsed.data.deductFromCash ?? true,
        items: {
          create: parsed.data.items,
        },
      },
    }),
  ]);

  revalidatePath("/admin/expenses");
}

export async function deleteExpense(id: string) {
  await requireOwner();
  await prisma.expense.delete({ where: { id } });
  revalidatePath("/admin/expenses");
}
