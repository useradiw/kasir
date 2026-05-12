"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";
import { getSettings } from "@/lib/settings";

export interface SettlementData {
  unsettled: {
    id: string;
    totalAmount: number;
    paidAt: string;
    sessionName: string;
    service: string;
    externalOrderId: string | null;
    processedBy: string | null;
  }[];
  settlements: {
    id: string;
    service: string;
    settlementDate: string;
    totalGross: number;
    commissionAmount: number;
    finalAmount: number;
    settledBy: string;
    notes: string | null;
    createdAt: string;
    items: {
      transactionId: string;
      sessionName: string;
      externalOrderId: string | null;
      totalAmount: number;
      paidAt: string;
    }[];
    deductions: { id: string; label: string; amount: number }[];
  }[];
  commissionSettings: {
    gofood: { pct: number; flat: number };
    shopeefood: { pct: number; flat: number };
    grabfood: { pct: number; flat: number };
  };
  summary: {
    unsettledCount: number;
    unsettledAmount: number;
    settledCount: number;
    settledAmount: number;
  };
}

const ONLINE_SERVICES = ["GoFood", "ShopeeFood", "GrabFood"] as const;

export async function getSettlementData(opts?: {
  service?: string;
}): Promise<SettlementData> {
  await requireRole("OWNER", "MANAGER", "CASHIER");

  const serviceFilter = opts?.service && ONLINE_SERVICES.includes(opts.service as typeof ONLINE_SERVICES[number])
    ? [opts.service as typeof ONLINE_SERVICES[number]]
    : [...ONLINE_SERVICES];

  const [unsettledTx, recentSettlements, settings] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        status: "PAID",
        paymentMethod: "PENDING",
        settlementItem: null,
        tableSession: { service: { in: serviceFilter } },
      },
      include: {
        tableSession: { select: { name: true, service: true, externalOrderId: true } },
        processedBy: { select: { name: true } },
      },
      orderBy: { paidAt: "desc" },
    }),
    prisma.onlineSettlement.findMany({
      where: serviceFilter.length < 3 ? { service: { in: serviceFilter } } : undefined,
      include: {
        settledBy: { select: { name: true } },
        items: {
          include: {
            transaction: {
              include: {
                tableSession: { select: { name: true, externalOrderId: true } },
              },
            },
          },
        },
        deductions: true,
      },
      orderBy: { settlementDate: "desc" },
      take: 50,
    }),
    getSettings(),
  ]);

  const commissionSettings = {
    gofood: {
      pct: parseFloat(settings.gofood_commission_pct ?? "0"),
      flat: parseInt(settings.gofood_commission_flat ?? "0"),
    },
    shopeefood: {
      pct: parseFloat(settings.shopeefood_commission_pct ?? "0"),
      flat: parseInt(settings.shopeefood_commission_flat ?? "0"),
    },
    grabfood: {
      pct: parseFloat(settings.grabfood_commission_pct ?? "0"),
      flat: parseInt(settings.grabfood_commission_flat ?? "0"),
    },
  };

  const unsettled = unsettledTx.map((t) => ({
    id: t.id,
    totalAmount: t.totalAmount,
    paidAt: t.paidAt.toISOString(),
    sessionName: t.tableSession.name,
    service: t.tableSession.service!,
    externalOrderId: t.tableSession.externalOrderId,
    processedBy: t.processedBy?.name ?? null,
  }));

  const settlements = recentSettlements.map((s) => ({
    id: s.id,
    service: s.service,
    settlementDate: s.settlementDate.toISOString(),
    totalGross: s.totalGross,
    commissionAmount: s.commissionAmount,
    finalAmount: s.finalAmount,
    settledBy: s.settledBy.name,
    notes: s.notes,
    createdAt: s.createdAt.toISOString(),
    items: s.items.map((item) => ({
      transactionId: item.transactionId,
      sessionName: item.transaction.tableSession.name,
      externalOrderId: item.transaction.tableSession.externalOrderId,
      totalAmount: item.transaction.totalAmount,
      paidAt: item.transaction.paidAt.toISOString(),
    })),
    deductions: s.deductions.map((d) => ({
      id: d.id,
      label: d.label,
      amount: d.amount,
    })),
  }));

  return {
    unsettled,
    settlements,
    commissionSettings,
    summary: {
      unsettledCount: unsettled.length,
      unsettledAmount: unsettled.reduce((s, t) => s + t.totalAmount, 0),
      settledCount: recentSettlements.reduce((s, st) => s + st.items.length, 0),
      settledAmount: recentSettlements.reduce((s, st) => s + st.finalAmount, 0),
    },
  };
}
