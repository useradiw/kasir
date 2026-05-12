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

  // --- Revenue summary ---
  const paidTx = transactions.filter((t) => t.status === "PAID");
  const totalRevenue = paidTx.reduce((s, t) => s + t.totalAmount, 0);
  const totalTransactions = paidTx.length;
  const avgTransaction = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;

  // --- Revenue by day (or by month for yearly) ---
  const revenueByDay: { date: string; revenue: number; count: number }[] = [];
  if (opts.period === "yearly") {
    const byMonth: Record<string, { revenue: number; count: number }> = {};
    for (const t of paidTx) {
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
    for (const t of paidTx) {
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

  // --- Payment method breakdown ---
  const paymentMethodMap: Record<string, { amount: number; count: number }> = {};
  for (const t of paidTx) {
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

  // --- Top selling items ---
  const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const t of paidTx) {
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

  // --- Cash register summary ---
  const cashByDate: Record<string, number> = {};
  const expenseByDate: Record<string, number> = {};
  for (const t of paidTx) {
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

  const isOwner = opts.isOwner ?? false;

  return {
    period: opts.period,
    dateRange: { start: localDateKey(start), end: localDateKey(new Date(end.getTime() - 1)) },
    revenue: { total: totalRevenue, count: totalTransactions, average: avgTransaction },
    totalExpenses: isOwner ? totalExpenses : 0,
    netProfit: isOwner ? totalRevenue - totalExpenses : 0,
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
    })),
    voidedCount: transactions.filter((t) => t.status === "VOIDED").length,
  };
}

export type ReportData = Awaited<ReturnType<typeof getReportData>>;
