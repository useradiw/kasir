"use server";

import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { getDateRange } from "./_shared";

export interface MenuPerformanceRow {
  key:          string;
  name:         string;
  variantLabel: string | null;
  type:         "menu" | "package" | "unknown";
  qtySold:      number;
  revenue:      number;
}

export async function getMenuPerformanceData(opts: {
  period: "daily" | "weekly" | "monthly" | "yearly";
  date:   string;
}) {
  await requireOwner();

  const { start, end } = getDateRange(opts.period, opts.date);

  const sessions = await prisma.tableSession.findMany({
    where: {
      transactions: { some: { status: "PAID", paidAt: { gte: start, lt: end } } },
    },
    select: {
      orderItems: {
        where: { status: { not: "CANCELLED" } },
        select: {
          menuItemId:   true,
          packageId:    true,
          variantId:    true,
          nameSnapshot: true,
          qty:          true,
          price:        true,
        },
      },
    },
  });

  const allItems = sessions.flatMap((s) => s.orderItems);

  type Group = {
    name:        string;
    variantLabel: string | null;
    menuItemId:  string | null;
    packageId:   string | null;
    variantId:   string | null;
    type:        "menu" | "package" | "unknown";
    qtySold:     number;
    revenue:     number;
  };

  const groups = new Map<string, Group>();

  for (const oi of allItems) {
    const key = oi.menuItemId
      ? `m:${oi.menuItemId}:${oi.variantId ?? "null"}`
      : oi.packageId
        ? `p:${oi.packageId}`
        : `u:${oi.nameSnapshot}`;

    if (!groups.has(key)) {
      groups.set(key, {
        name:         oi.nameSnapshot,
        variantLabel: null,
        menuItemId:   oi.menuItemId ?? null,
        packageId:    oi.packageId ?? null,
        variantId:    oi.variantId ?? null,
        type:         oi.menuItemId ? "menu" : oi.packageId ? "package" : "unknown",
        qtySold:      0,
        revenue:      0,
      });
    }
    const g = groups.get(key)!;
    g.qtySold += oi.qty;
    g.revenue += oi.price * oi.qty;
  }

  const variantIds = [...new Set([...groups.values()].map((g) => g.variantId).filter(Boolean) as string[])];

  const variants = variantIds.length > 0
    ? await prisma.menuVariant.findMany({ where: { id: { in: variantIds } }, select: { id: true, label: true } })
    : [];

  const variantMap = new Map(variants.map((v) => [v.id, v.label]));

  const rows: MenuPerformanceRow[] = [];

  for (const [key, g] of groups) {
    if (g.variantId) g.variantLabel = variantMap.get(g.variantId) ?? null;

    rows.push({ key, name: g.name, variantLabel: g.variantLabel, type: g.type,
                qtySold: g.qtySold, revenue: g.revenue });
  }

  rows.sort((a, b) => b.revenue - a.revenue);

  const totals = rows.reduce(
    (acc, r) => ({
      qtySold: acc.qtySold + r.qtySold,
      revenue: acc.revenue + r.revenue,
    }),
    { qtySold: 0, revenue: 0 },
  );

  return { period: opts.period, rows, totals };
}

export type MenuPerformanceData = Awaited<ReturnType<typeof getMenuPerformanceData>>;
