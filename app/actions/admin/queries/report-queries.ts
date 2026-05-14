"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";
import { localDateKey } from "@/lib/format";
import { computeExpenseTotal } from "@/lib/expense-utils";

// ─── Date Range Helper ──────────────────────────────────────────────────────

function getDateRange(period: "daily" | "weekly" | "monthly" | "yearly", dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const base = new Date(y, m - 1, d);

  if (period === "daily") {
    const start = new Date(y, m - 1, d);
    const end = new Date(y, m - 1, d + 1);
    return { start, end };
  }

  if (period === "weekly") {
    // Monday-based week
    const day = base.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday = 1
    const monday = new Date(y, m - 1, d + diff);
    const nextMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
    return { start: monday, end: nextMonday };
  }

  if (period === "yearly") {
    const start = new Date(y, 0, 1);
    const end = new Date(y + 1, 0, 1);
    return { start, end };
  }

  // monthly
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { start, end };
}

// ─── Report Data ─────────────────────────────────────────────────────────────

export async function getReportData(opts: {
  period: "daily" | "weekly" | "monthly" | "yearly";
  date: string;
  isOwner?: boolean;
}) {
  await requireRole("OWNER", "MANAGER");

  const { start, end } = getDateRange(opts.period, opts.date);

  // Load commission settings for online vendors
  const [
    transactions,
    expenses,
    cashRegisters,
    attendanceRecords,
    settings,
  ] = await Promise.all([
    prisma.transaction.findMany({
      where: { paidAt: { gte: start, lt: end } },
      include: {
        processedBy: { select: { name: true } },
        tableSession: {
          select: {
            name: true,
            service: true,
            orderItems: {
              select: { nameSnapshot: true, qty: true, price: true, status: true },
            },
          },
        },
      },
      orderBy: { paidAt: "desc" },
      // cogs is included automatically via Prisma include
    }),
    prisma.expense.findMany({
      where: { recordedAt: { gte: start, lt: end } },
      orderBy: { recordedAt: "desc" },
      include: { items: true },
    }),
    prisma.cashRegister.findMany({
      where: { date: { gte: start, lt: end } },
      orderBy: { date: "desc" },
    }),
    prisma.attendanceRecord.findMany({
      where: { date: { gte: start, lt: end } },
      include: { staff: { select: { name: true } } },
    }),
    prisma.setting.findMany({
      where: {
        key: {
          in: [
            "gofood_commission_pct", "gofood_commission_flat",
            "shopeefood_commission_pct", "shopeefood_commission_flat",
            "grabfood_commission_pct", "grabfood_commission_flat",
          ],
        },
      },
    }),
  ]);

  // Parse commission settings
  const settingMap: Record<string, string> = {};
  for (const s of settings) settingMap[s.key] = s.value;
  function num(v: string | undefined, isFloat = true): number {
    if (!v) return 0;
    const n = isFloat ? parseFloat(v) : parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  const commissionBySvc: Record<string, { pct: number; flat: number }> = {
    GoFood:     { pct: num(settingMap.gofood_commission_pct),     flat: num(settingMap.gofood_commission_flat, false) },
    ShopeeFood: { pct: num(settingMap.shopeefood_commission_pct), flat: num(settingMap.shopeefood_commission_flat, false) },
    GrabFood:   { pct: num(settingMap.grabfood_commission_pct),   flat: num(settingMap.grabfood_commission_flat, false) },
  };
  function calcCommission(amount: number, svc: string): number {
    const c = commissionBySvc[svc];
    if (!c || (c.pct === 0 && c.flat === 0)) return 0;
    return Math.round(amount * c.pct / 100) + c.flat;
  }

  const ONLINE_SERVICES = ["GoFood", "ShopeeFood", "GrabFood"];

  // --- Split paid transactions into offline and online ---
  const paidTx = transactions.filter((t) => t.status === "PAID");
  const offlineTx = paidTx.filter((t) => !ONLINE_SERVICES.includes(t.tableSession.service as string));
  const onlineTx = paidTx.filter((t) => ONLINE_SERVICES.includes(t.tableSession.service as string));

  // --- Revenue summary (offline only) ---
  const totalRevenue = offlineTx.reduce((s, t) => s + t.totalAmount, 0);
  const totalTransactions = offlineTx.length;

  // --- Revenue by day (or by month for yearly) — offline only ---
  const revenueByDay: { date: string; revenue: number; count: number }[] = [];
  if (opts.period === "yearly") {
    const byMonth: Record<string, { revenue: number; count: number }> = {};
    for (const t of offlineTx) {
      const d = t.paidAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!byMonth[key]) byMonth[key] = { revenue: 0, count: 0 };
      byMonth[key].revenue += t.totalAmount;
      byMonth[key].count += 1;
    }
    const year = start.getFullYear();
    for (let mo = 0; mo < 12; mo++) {
      const key = `${year}-${String(mo + 1).padStart(2, "0")}`;
      revenueByDay.push({ date: key, ...(byMonth[key] ?? { revenue: 0, count: 0 }) });
    }
  } else {
    const revenueByDayMap: Record<string, { revenue: number; count: number }> = {};
    for (const t of offlineTx) {
      const key = localDateKey(t.paidAt);
      if (!revenueByDayMap[key]) revenueByDayMap[key] = { revenue: 0, count: 0 };
      revenueByDayMap[key].revenue += t.totalAmount;
      revenueByDayMap[key].count += 1;
    }
    const cursor = new Date(start);
    while (cursor < end) {
      const key = localDateKey(cursor);
      revenueByDay.push({ date: key, ...(revenueByDayMap[key] ?? { revenue: 0, count: 0 }) });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  // --- Payment method breakdown (offline only) ---
  const paymentMethodMap: Record<string, { amount: number; count: number }> = {};
  for (const t of offlineTx) {
    const m = t.paymentMethod as string;
    if (!paymentMethodMap[m]) paymentMethodMap[m] = { amount: 0, count: 0 };
    paymentMethodMap[m].amount += t.totalAmount;
    paymentMethodMap[m].count += 1;
  }
  const paymentMethods = Object.entries(paymentMethodMap).map(([method, v]) => ({
    method,
    ...v,
  }));

  // --- Service channel breakdown (with commission) ---
  const serviceMap: Record<string, { amount: number; commission: number; netAmount: number; count: number }> = {};
  for (const t of paidTx) {
    const svc = (t.tableSession.service as string) ?? "Dine In";
    if (!serviceMap[svc]) serviceMap[svc] = { amount: 0, commission: 0, netAmount: 0, count: 0 };
    const commission = calcCommission(t.totalAmount, svc);
    serviceMap[svc].amount += t.totalAmount;
    serviceMap[svc].commission += commission;
    serviceMap[svc].netAmount += t.totalAmount - commission;
    serviceMap[svc].count += 1;
  }
  const serviceChannels = Object.entries(serviceMap).map(([service, v]) => ({
    service,
    ...v,
  }));

  // --- Top selling items (offline only) ---
  const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const t of offlineTx) {
    for (const oi of t.tableSession.orderItems) {
      if (oi.status === "CANCELLED") continue;
      const key = oi.nameSnapshot;
      if (!itemMap[key]) itemMap[key] = { name: key, qty: 0, revenue: 0 };
      itemMap[key].qty += oi.qty;
      itemMap[key].revenue += oi.price * oi.qty;
    }
  }
  const topItems = Object.values(itemMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  // --- Expense summary ---
  const totalExpenses = expenses.reduce((s, e) => s + computeExpenseTotal(e.items), 0);

  // --- Cash register summary (offline only) ---
  const cashByDate: Record<string, number> = {};
  const expenseByDate: Record<string, number> = {};
  for (const t of offlineTx) {
    if (t.paymentMethod !== "CASH") continue;
    const key = localDateKey(t.paidAt);
    cashByDate[key] = (cashByDate[key] ?? 0) + t.totalAmount;
  }
  for (const e of expenses) {
    if (!e.deductFromCash) continue;
    const key = localDateKey(e.recordedAt);
    expenseByDate[key] = (expenseByDate[key] ?? 0) + computeExpenseTotal(e.items);
  }
  const cashRegisterSummary = cashRegisters.map((r) => {
    const key = localDateKey(r.date);
    const cashIncome = cashByDate[key] ?? 0;
    const dayExpenses = expenseByDate[key] ?? 0;
    const expectedClosing = r.openingCash + cashIncome - dayExpenses;
    return {
      date: localDateKey(r.date),
      openingCash: r.openingCash,
      closingCash: r.closingCash,
      cashIncome,
      expenses: dayExpenses,
      expectedClosing,
      difference: r.closingCash !== null ? r.closingCash - expectedClosing : null,
    };
  });

  // --- Attendance summary ---
  const attendanceDayMap: Record<string, { present: number; absent: number }> = {};
  for (const r of attendanceRecords) {
    const key = localDateKey(r.date);
    if (!attendanceDayMap[key]) attendanceDayMap[key] = { present: 0, absent: 0 };
    if (r.status === "PRESENT") attendanceDayMap[key].present += 1;
    else attendanceDayMap[key].absent += 1;
  }
  const attendanceSummary = Object.entries(attendanceDayMap).map(([date, v]) => ({
    date,
    ...v,
  }));

  // --- Online orders summary ---
  const onlineGross = onlineTx.reduce((s, t) => s + t.totalAmount, 0);
  const onlineCommission = onlineTx.reduce((s, t) => s + calcCommission(t.totalAmount, t.tableSession.service as string), 0);

  const onlineTxIds = onlineTx.map((t) => t.id);
  const settlementItems = onlineTxIds.length > 0
    ? await prisma.settlementItem.findMany({
        where: { transactionId: { in: onlineTxIds } },
        include: {
          settlement: {
            include: { deductions: true },
          },
        },
      })
    : [];
  const settledTxIds = new Set(settlementItems.map((si) => si.transactionId));
  const settledSettlementIds = new Set(settlementItems.map((si) => si.settlementId));

  const uniqueSettlements = [...settledSettlementIds].map((sid) => {
    const item = settlementItems.find((si) => si.settlementId === sid)!;
    return item.settlement;
  });

  const disbursedRevenue = uniqueSettlements.reduce((s, st) => s + st.finalAmount, 0);
  const totalSettlementCommission = uniqueSettlements.reduce((s, st) => s + st.commissionAmount, 0);
  const totalDeductions = uniqueSettlements.reduce(
    (s, st) => s + st.deductions.reduce((ds, d) => ds + d.amount, 0),
    0,
  );

  const onlineByService: Record<string, { count: number; gross: number; disbursed: number }> = {};
  for (const t of onlineTx) {
    const svc = t.tableSession.service as string;
    if (!onlineByService[svc]) onlineByService[svc] = { count: 0, gross: 0, disbursed: 0 };
    onlineByService[svc].count += 1;
    onlineByService[svc].gross += t.totalAmount;
  }
  for (const si of settlementItems) {
    const svc = si.settlement.service;
    if (onlineByService[svc]) {
      const itemShare = si.settlement.finalAmount / Math.max(1, settlementItems.filter((x) => x.settlementId === si.settlementId).length);
      onlineByService[svc].disbursed += Math.round(itemShare);
    }
  }

  const onlineOrdersSummary = {
    count: onlineTx.length,
    gross: onlineGross,
    commission: totalSettlementCommission || onlineCommission,
    deductions: totalDeductions,
    disbursedRevenue,
    settledCount: settledTxIds.size,
    unsettledCount: onlineTx.length - settledTxIds.size,
    unsettledAmount: onlineTx.filter((t) => !settledTxIds.has(t.id)).reduce((s, t) => s + t.totalAmount, 0),
    byService: Object.entries(onlineByService).map(([service, v]) => ({ service, ...v })),
  };

  const isOwner = opts.isOwner ?? false;

  // --- COGS summary (paid offline + online transactions with COGS recorded) ---
  const totalCogs = paidTx.reduce((s, t) => s + (t.cogs ?? 0), 0);
  const totalRevenueCombined = totalRevenue + disbursedRevenue;
  const grossProfit = totalRevenueCombined - totalCogs;
  const grossMarginPct = totalRevenueCombined > 0
    ? Math.round((grossProfit / totalRevenueCombined) * 1000) / 10
    : null;

  return {
    period: opts.period,
    dateRange: { start: localDateKey(start), end: localDateKey(new Date(end.getTime() - 1)) },
    revenue: {
      total: totalRevenueCombined,
      offlineTotal: totalRevenue,
      onlineDisbursed: disbursedRevenue,
      count: totalTransactions + onlineTx.length,
      average: (totalTransactions + onlineTx.length) > 0
        ? Math.round(totalRevenueCombined / (totalTransactions + onlineTx.length))
        : 0,
    },
    totalExpenses: isOwner ? totalExpenses : 0,
    netProfit: isOwner ? totalRevenueCombined - totalExpenses : 0,
    cogs: isOwner ? totalCogs : 0,
    grossProfit: isOwner ? grossProfit : 0,
    grossMarginPct: isOwner ? grossMarginPct : null,
    onlineOrdersSummary,
    revenueByDay,
    paymentMethods,
    serviceChannels,
    topItems,
    cashRegisterSummary: isOwner ? cashRegisterSummary : [],
    attendanceSummary,
    expenses: isOwner ? expenses.map((e) => ({
      id: e.id,
      total: computeExpenseTotal(e.items),
      description: e.description,
      recordedAt: e.recordedAt.toISOString(),
      items: e.items.map((i) => ({
        description: i.description,
        amount: i.amount,
        cost: i.cost,
      })),
    })) : [],
    transactions: paidTx.map((t) => ({
      id: t.id,
      sessionName: t.tableSession.name,
      service: (t.tableSession.service as string) ?? null,
      totalAmount: t.totalAmount,
      cashAmount: t.cashAmount,
      qrisAmount: t.qrisAmount,
      paymentMethod: t.paymentMethod as string,
      status: t.status as string,
      paidAt: t.paidAt.toISOString(),
      processedBy: t.processedBy?.name ?? null,
      cogs: t.cogs ?? null,
    })),
    voidedCount: transactions.filter((t) => t.status === "VOIDED").length,
  };
}

export type ReportData = Awaited<ReturnType<typeof getReportData>>;
