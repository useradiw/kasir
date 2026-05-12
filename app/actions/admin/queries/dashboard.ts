"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";

export async function getDashboardData() {
  await requireRole("OWNER", "MANAGER");

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const [todayRevenue, todayCount, activeStaff, menuItems, recentTransactions] =
    await Promise.all([
      prisma.transaction.aggregate({
        where: { status: "PAID", paidAt: { gte: startOfDay, lt: endOfDay } },
        _sum: { totalAmount: true },
      }),
      prisma.transaction.count({
        where: { status: "PAID", paidAt: { gte: startOfDay, lt: endOfDay } },
      }),
      prisma.staff.count({ where: { isActive: true } }),
      prisma.menuItem.count({ where: { isHidden: false } }),
      prisma.transaction.findMany({
        take: 5,
        orderBy: { paidAt: "desc" },
        where: { status: "PAID" },
        include: {
          tableSession: { select: { name: true } },
          processedBy: { select: { name: true } },
        },
      }),
    ]);

  return {
    todayRevenue: todayRevenue._sum.totalAmount ?? 0,
    todayCount,
    activeStaff,
    menuItems,
    recentTransactions: recentTransactions.map((t) => ({
      id: t.id,
      sessionName: t.tableSession.name,
      totalAmount: t.totalAmount,
      paymentMethod: t.paymentMethod as string,
      paidAt: t.paidAt.toISOString(),
    })),
  };
}
