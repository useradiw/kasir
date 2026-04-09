"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";
import { z } from "zod";

const expenseItemSchema = z.object({
  description: z.string().min(1, "Deskripsi item harus diisi"),
  amount: z.coerce.number().int().min(1, "Jumlah harus minimal 1"),
  cost: z.coerce.number().int().min(0, "Biaya tidak boleh negatif"),
});

const expenseSchema = z.object({
  description: z.string().optional(),
  items: z.array(expenseItemSchema).min(1, "Minimal 1 item pengeluaran"),
});

export async function addExpenseForStaff(data: {
  description?: string;
  items: { description: string; amount: number; cost: number }[];
}) {
  const staff = await requireRole("OWNER", "MANAGER", "CASHIER");

  const parsed = expenseSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  await prisma.expense.create({
    data: {
      description: parsed.data.description || null,
      staffId: staff.id,
      recordedAt: new Date(),
      items: {
        create: parsed.data.items,
      },
    },
  });

  revalidatePath("/expenses");
  revalidatePath("/admin/expenses");
  revalidatePath("/cashregister");
}
