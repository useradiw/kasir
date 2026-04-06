"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";
import { z } from "zod";

const expenseSchema = z.object({
  amount: z.coerce.number().int().min(1, "Jumlah harus lebih dari 0"),
  note: z.string().optional(),
  recordedAt: z.string().optional(),
});

export async function addExpenseForStaff(formData: FormData) {
  await requireRole("OWNER", "MANAGER", "CASHIER");

  const parsed = expenseSchema.safeParse({
    amount: formData.get("amount"),
    note: formData.get("note") || undefined,
    recordedAt: formData.get("recordedAt") || undefined,
  });
  if (!parsed.success) throw new Error(Object.values(parsed.error.flatten().fieldErrors).flat()[0]);

  await prisma.expense.create({
    data: {
      amount: parsed.data.amount,
      note: parsed.data.note,
      recordedAt: parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : new Date(),
    },
  });

  revalidatePath("/expenses");
  revalidatePath("/admin/expenses");
  revalidatePath("/cashregister");
}
