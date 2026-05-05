"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { z } from "zod";

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
  const staff = await requireOwner();
  const parsed = entrySchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  await prisma.kasPakHar.create({
    data: {
      type: parsed.data.type,
      amount: parsed.data.amount,
      description: parsed.data.description || null,
      createdById: staff.id,
    },
  });

  revalidatePath("/admin/kas-pak-har");
}

export async function deleteKasPakHarEntry(id: string) {
  await requireOwner();
  await prisma.kasPakHar.delete({ where: { id } });
  revalidatePath("/admin/kas-pak-har");
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
