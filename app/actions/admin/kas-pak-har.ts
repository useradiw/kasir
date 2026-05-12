"use server";

import { revalidateExpenses } from "@/lib/revalidate";
import { prisma } from "@/lib/prisma";
import { requireOwner, requireRole } from "@/lib/admin-auth";
import { z } from "zod";
import { runAction } from "@/lib/action-error";

const entrySchema = z.object({
  type: z.enum(["DEPOSIT", "WITHDRAWAL"]),
  amount: z.coerce.number().int().min(1, "Jumlah harus lebih dari 0"),
  description: z.string().optional(),
});

export async function addKasPakHarEntry(data: {
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: number;
  description?: string;
}) {
  return runAction(async () => {
    const staff = await requireRole("OWNER", "MANAGER");
    const parsed = entrySchema.parse(data);
    await prisma.kasPakHar.create({
      data: {
        type: parsed.type,
        amount: parsed.amount,
        description: parsed.description || null,
        createdById: staff.id,
      },
    });
    revalidateExpenses();
  });
}

export async function deleteKasPakHarEntry(id: string) {
  return runAction(async () => {
    await requireOwner();
    await prisma.kasPakHar.delete({ where: { id } });
    revalidateExpenses();
  });
}

export async function getKasPakHarData() {
  await requireOwner();

  const entries = await prisma.kasPakHar.findMany({
    orderBy: { date: "desc" },
    take: 100,
    include: {
      createdBy: { select: { name: true } },
      expense: { select: { id: true, description: true } },
    },
  });

  let balance = 0;
  const all = await prisma.kasPakHar.findMany();
  for (const e of all) {
    if (e.type === "DEPOSIT") balance += e.amount;
    else balance -= e.amount;
  }

  return {
    balance,
    entries: entries.map((e) => ({
      id: e.id,
      date: e.date.toISOString(),
      type: e.type as string,
      amount: e.amount,
      description: e.description,
      createdByName: e.createdBy?.name ?? null,
      expenseDescription: e.expense?.description ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}
