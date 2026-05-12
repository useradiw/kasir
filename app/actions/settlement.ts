"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";
import { runAction, ActionError } from "@/lib/action-error";
import { revalidateSettlement } from "@/lib/revalidate";

const ONLINE_SERVICES = ["GoFood", "ShopeeFood", "GrabFood"];

const createSettlementSchema = z.object({
  service: z.enum(["GoFood", "ShopeeFood", "GrabFood"]),
  transactionIds: z.array(z.string().min(1)).min(1),
  commissionAmount: z.number().int().min(0),
  deductions: z.array(z.object({
    label: z.string().min(1),
    amount: z.number().int().min(0),
  })),
  finalAmount: z.number().int().min(0),
  notes: z.string().optional(),
});

export async function createSettlement(input: z.infer<typeof createSettlementSchema>) {
  return runAction(async () => {
    const staff = await requireRole("OWNER", "MANAGER", "CASHIER");
    const data = createSettlementSchema.parse(input);

    const transactions = await prisma.transaction.findMany({
      where: { id: { in: data.transactionIds } },
      include: {
        tableSession: { select: { service: true } },
        settlementItem: { select: { id: true } },
      },
    });

    if (transactions.length !== data.transactionIds.length) {
      throw new ActionError("Beberapa transaksi tidak ditemukan.");
    }

    for (const tx of transactions) {
      if (tx.status !== "PAID") {
        throw new ActionError("Transaksi harus berstatus PAID.");
      }
      if (!tx.tableSession.service || !ONLINE_SERVICES.includes(tx.tableSession.service)) {
        throw new ActionError("Hanya transaksi online yang bisa dicairkan.");
      }
      if (tx.settlementItem) {
        throw new ActionError("Transaksi sudah pernah dicairkan.");
      }
    }

    const totalGross = transactions.reduce((s, t) => s + t.totalAmount, 0);

    await prisma.onlineSettlement.create({
      data: {
        service: data.service,
        totalGross,
        commissionAmount: data.commissionAmount,
        finalAmount: data.finalAmount,
        settledById: staff.id,
        notes: data.notes || null,
        items: {
          create: data.transactionIds.map((transactionId) => ({
            transactionId,
          })),
        },
        deductions: {
          create: data.deductions
            .filter((d) => d.amount > 0)
            .map((d) => ({
              label: d.label,
              amount: d.amount,
            })),
        },
      },
    });

    revalidateSettlement();
  });
}

export async function deleteSettlement(settlementId: string) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");

    const settlement = await prisma.onlineSettlement.findUnique({
      where: { id: settlementId },
    });
    if (!settlement) throw new ActionError("Data pencairan tidak ditemukan.");

    await prisma.onlineSettlement.delete({ where: { id: settlementId } });

    revalidateSettlement();
  });
}
