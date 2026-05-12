"use server";

import { revalidateExpenseTemplates } from "@/lib/revalidate";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";
import { z } from "zod";
import { runAction } from "@/lib/action-error";

const templateSchema = z.object({
  name: z.string().min(1, "Nama tidak boleh kosong"),
  defaultUnit: z.string().optional(),
  defaultCost: z.coerce.number().int().min(0).nullable().optional(),
});

export async function getExpenseTemplates() {
  await requireRole("OWNER", "MANAGER", "CASHIER");
  return prisma.expenseTemplate.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, defaultUnit: true, defaultCost: true },
  });
}

export async function getDistinctExpenseItemNames() {
  await requireRole("OWNER", "MANAGER", "CASHIER");
  const items = await prisma.expenseItem.findMany({
    select: { description: true },
    distinct: ["description"],
    orderBy: { description: "asc" },
    take: 100,
  });
  return items.map((i) => i.description);
}

export async function addExpenseTemplate(data: {
  name: string;
  defaultUnit?: string;
  defaultCost?: number | null;
}) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const parsed = templateSchema.parse(data);
    await prisma.expenseTemplate.create({
      data: {
        name: parsed.name,
        defaultUnit: parsed.defaultUnit || null,
        defaultCost: parsed.defaultCost ?? null,
      },
    });
    revalidateExpenseTemplates();
  });
}

export async function updateExpenseTemplate(id: string, data: {
  name: string;
  defaultUnit?: string;
  defaultCost?: number | null;
}) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const parsed = templateSchema.parse(data);
    await prisma.expenseTemplate.update({
      where: { id },
      data: {
        name: parsed.name,
        defaultUnit: parsed.defaultUnit || null,
        defaultCost: parsed.defaultCost ?? null,
      },
    });
    revalidateExpenseTemplates();
  });
}

export async function deleteExpenseTemplate(id: string) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    // Soft delete: deactivate instead of hard delete (keeps history intact)
    await prisma.expenseTemplate.update({
      where: { id },
      data: { isActive: false },
    });
    revalidateExpenseTemplates();
  });
}
