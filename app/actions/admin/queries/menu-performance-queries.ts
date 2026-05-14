"use server";

import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";

// ─── Date range (reused from report-queries) ───────────────────────────────────

function getDateRange(period: "daily" | "weekly" | "monthly" | "yearly", dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const base = new Date(y, m - 1, d);

  if (period === "daily") return { start: new Date(y, m - 1, d), end: new Date(y, m - 1, d + 1) };

  if (period === "weekly") {
    const day = base.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(y, m - 1, d + diff);
    return { start: monday, end: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7) };
  }

  if (period === "yearly") {
    return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
  }

  // monthly
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

// ─── Per-item performance row ──────────────────────────────────────────────────

export interface MenuPerformanceRow {
  key: string;               // menuItemId|variantId or packageId or nameSnapshot (fallback)
  name: string;
  variantLabel: string | null;
  type: "menu" | "package" | "unknown";
  hasRecipe: boolean;
  qtySold: number;
  revenue: number;
  cogsPerPortion: number;    // 0 if no recipe
  totalCogs: number;
  grossProfit: number;
  marginPct: number | null;  // null if no recipe or selling price = 0
}

// ─── Main query ────────────────────────────────────────────────────────────────

export async function getMenuPerformanceData(opts: {
  period: "daily" | "weekly" | "monthly" | "yearly";
  date: string;
}) {
  await requireOwner();

  const { start, end } = getDateRange(opts.period, opts.date);

  // Load all paid transactions + their order items with FK refs
  const sessions = await prisma.tableSession.findMany({
    where: {
      transactions: { some: { status: "PAID", paidAt: { gte: start, lt: end } } },
    },
    select: {
      orderItems: {
        where: { status: { not: "CANCELLED" } },
        select: {
          menuItemId: true,
          packageId: true,
          variantId: true,
          nameSnapshot: true,
          qty: true,
          price: true,
        },
      },
    },
  });

  const allItems = sessions.flatMap((s) => s.orderItems);

  // Group by identity key
  type GroupKey = string;
  const groups = new Map<
    GroupKey,
    {
      name: string;
      variantLabel: string | null;
      menuItemId: string | null;
      packageId: string | null;
      variantId: string | null;
      type: "menu" | "package" | "unknown";
      qtySold: number;
      revenue: number;
    }
  >();

  for (const oi of allItems) {
    const key = oi.menuItemId
      ? `m:${oi.menuItemId}:${oi.variantId ?? "null"}`
      : oi.packageId
        ? `p:${oi.packageId}`
        : `u:${oi.nameSnapshot}`;

    if (!groups.has(key)) {
      groups.set(key, {
        name: oi.nameSnapshot,
        variantLabel: null,       // filled in below
        menuItemId: oi.menuItemId ?? null,
        packageId: oi.packageId ?? null,
        variantId: oi.variantId ?? null,
        type: oi.menuItemId ? "menu" : oi.packageId ? "package" : "unknown",
        qtySold: 0,
        revenue: 0,
      });
    }

    const g = groups.get(key)!;
    g.qtySold += oi.qty;
    g.revenue += oi.price * oi.qty;
  }

  // Load variant labels and recipes in bulk
  const menuItemIds = [...new Set([...groups.values()].map((g) => g.menuItemId).filter(Boolean) as string[])];
  const variantIds  = [...new Set([...groups.values()].map((g) => g.variantId).filter(Boolean) as string[])];
  const packageIds  = [...new Set([...groups.values()].map((g) => g.packageId).filter(Boolean) as string[])];

  const [variants, recipes, packageItems] = await Promise.all([
    variantIds.length > 0
      ? prisma.menuVariant.findMany({
          where: { id: { in: variantIds } },
          select: { id: true, label: true },
        })
      : [],
    menuItemIds.length > 0
      ? prisma.recipe.findMany({
          where: { menuItemId: { in: menuItemIds } },
          include: { ingredients: { select: { templateId: true, quantity: true } } },
          orderBy: [{ menuItemId: "asc" }],
        })
      : [],
    packageIds.length > 0
      ? prisma.packageItem.findMany({
          where: { packageId: { in: packageIds } },
          select: { packageId: true, menuItemId: true, variantId: true },
        })
      : [],
  ]);

  const variantMap = new Map(variants.map((v) => [v.id, v.label]));

  // recipe lookup: key = `${menuItemId}:${variantId ?? "null"}`
  const recipeMap = new Map(recipes.map((r) => [`${r.menuItemId}:${r.variantId ?? "null"}`, r]));

  // package → member menuItemIds
  const pkgMembersMap = new Map<string, { menuItemId: string; variantId: string | null }[]>();
  for (const pi of packageItems) {
    if (!pkgMembersMap.has(pi.packageId)) pkgMembersMap.set(pi.packageId, []);
    pkgMembersMap.get(pi.packageId)!.push({ menuItemId: pi.menuItemId, variantId: pi.variantId ?? null });
  }

  // Collect all template IDs needed for cost lookup
  const allTemplateIds = new Set<string>();
  for (const r of recipes) {
    for (const ing of r.ingredients) {
      if (ing.templateId) allTemplateIds.add(ing.templateId);
    }
  }

  // Load latest cost for each template (parallel)
  const costEntries = await Promise.all(
    [...allTemplateIds].map(async (templateId) => {
      const latest = await prisma.expenseItem.findFirst({
        where: { templateId },
        orderBy: { expense: { recordedAt: "desc" } },
        select: { cost: true },
      });
      return [templateId, latest?.cost ?? 0] as [string, number];
    }),
  );
  const costMap = new Map(costEntries);

  function recipeCogsPerPortion(menuItemId: string, variantId: string | null): number {
    const r = recipeMap.get(`${menuItemId}:${variantId ?? "null"}`);
    if (!r) return 0;
    return Math.round(
      r.ingredients.reduce((sum, ing) => {
        if (!ing.templateId) return sum;
        return sum + ing.quantity * (costMap.get(ing.templateId) ?? 0);
      }, 0),
    );
  }

  // Build rows
  const rows: MenuPerformanceRow[] = [];

  for (const [key, g] of groups) {
    // Fill variant label
    if (g.variantId) g.variantLabel = variantMap.get(g.variantId) ?? null;

    let cogsPerPortion = 0;
    let hasRecipe = false;

    if (g.type === "menu" && g.menuItemId) {
      const cpp = recipeCogsPerPortion(g.menuItemId, g.variantId);
      hasRecipe = recipeMap.has(`${g.menuItemId}:${g.variantId ?? "null"}`);
      cogsPerPortion = cpp;
    } else if (g.type === "package" && g.packageId) {
      const members = pkgMembersMap.get(g.packageId) ?? [];
      if (members.length > 0) {
        cogsPerPortion = Math.round(
          members.reduce((sum, m) => sum + recipeCogsPerPortion(m.menuItemId, m.variantId), 0),
        );
        hasRecipe = members.some((m) => recipeMap.has(`${m.menuItemId}:${m.variantId ?? "null"}`));
      }
    }

    const totalCogs = cogsPerPortion * g.qtySold;
    const grossProfit = g.revenue - totalCogs;
    const avgPrice = g.qtySold > 0 ? g.revenue / g.qtySold : 0;
    const marginPct = hasRecipe && avgPrice > 0
      ? Math.round(((avgPrice - cogsPerPortion) / avgPrice) * 1000) / 10
      : null;

    rows.push({
      key,
      name: g.name,
      variantLabel: g.variantLabel,
      type: g.type,
      hasRecipe,
      qtySold: g.qtySold,
      revenue: g.revenue,
      cogsPerPortion,
      totalCogs,
      grossProfit,
      marginPct,
    });
  }

  // Sort by revenue desc
  rows.sort((a, b) => b.revenue - a.revenue);

  // Summary totals
  const totals = rows.reduce(
    (acc, r) => ({
      qtySold: acc.qtySold + r.qtySold,
      revenue: acc.revenue + r.revenue,
      totalCogs: acc.totalCogs + r.totalCogs,
      grossProfit: acc.grossProfit + r.grossProfit,
    }),
    { qtySold: 0, revenue: 0, totalCogs: 0, grossProfit: 0 },
  );

  const overallMarginPct =
    totals.revenue > 0 ? Math.round((totals.grossProfit / totals.revenue) * 1000) / 10 : null;

  return {
    period: opts.period,
    rows,
    totals: { ...totals, marginPct: overallMarginPct },
  };
}

export type MenuPerformanceData = Awaited<ReturnType<typeof getMenuPerformanceData>>;
