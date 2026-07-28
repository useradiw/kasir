"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";
import { runAction, ActionError } from "@/lib/action-error";
import { revalidateSettlement } from "@/lib/revalidate";
import { localDateKey } from "@/lib/format";
import {
  SettlementPostingRepository,
  SettlementImbalanceError,
} from "@/lib/accounting/settlementPostingRepository";
import { SalesChannelRepository } from "@/lib/accounting/salesChannelRepository";

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
    const deductions = data.deductions.filter((d) => d.amount > 0);
    const deductionsTotal = deductions.reduce((s, d) => s + d.amount, 0);

    // Validate BEFORE writing anything. Reuses the engine's own error/message
    // (SettlementImbalanceError) so the "seimbang" check the UI shows and the
    // one the ledger enforces are the exact same rule, worded once.
    const receivedSide = data.finalAmount + data.commissionAmount + deductionsTotal;
    if (receivedSide !== totalGross) {
      throw new SettlementImbalanceError(
        BigInt(totalGross),
        BigInt(data.finalAmount),
        BigInt(data.commissionAmount),
        BigInt(deductionsTotal),
      );
    }

    const settlement = await prisma.onlineSettlement.create({
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
          create: deductions.map((d) => ({
            label: d.label,
            amount: d.amount,
          })),
        },
      },
    });

    // A settlement is an owner/manager back-office action — unlike tutup kas,
    // it's fine to fail the whole thing when accounts aren't mapped. But a
    // settlement row must never exist without its posting: either both
    // happen or neither, so a failed post deletes the row we just created
    // (cascades to its items/deductions) and re-throws — the underlying
    // error (e.g. ChannelAccountNotSetError) already says what to configure.
    try {
      const accounts = await new SalesChannelRepository(prisma).require(["online"]);
      await new SettlementPostingRepository(prisma).postSettlement({
        date: localDateKey(settlement.settlementDate),
        settlementId: settlement.id,
        service: data.service,
        totalGross: BigInt(totalGross),
        commissionAmount: BigInt(data.commissionAmount),
        deductionsTotal: BigInt(deductionsTotal),
        finalAmount: BigInt(data.finalAmount),
        cashAccount: accounts.online,
      });
    } catch (e) {
      await prisma.onlineSettlement.delete({ where: { id: settlement.id } });
      throw e;
    }

    revalidateSettlement();
  });
}

export async function deleteSettlement(settlementId: string) {
  return runAction(async () => {
    await requireRole("OWNER");

    const settlement = await prisma.onlineSettlement.findUnique({
      where: { id: settlementId },
    });
    if (!settlement) throw new ActionError("Data pencairan tidak ditemukan.");

    const postings = new SettlementPostingRepository(prisma);
    const existingPosting = await postings.getPostingFor(settlementId);
    if (existingPosting) {
      // Void the ledger entry FIRST — the reversal stays; only the
      // correlation row is removed so the pencairan can be re-entered.
      await postings.voidSettlement(settlementId);
    }

    await prisma.onlineSettlement.delete({ where: { id: settlementId } });

    revalidateSettlement();
  });
}
