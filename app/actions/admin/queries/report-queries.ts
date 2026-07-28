"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";
import { localDateKey } from "@/lib/format";
import { getDateRange, reconcileCashDates } from "./_shared";
import { getLedgerExpenseTotals, getLedgerPengeluaranForPeriod } from "./ledger-cash-queries";

// ─── Report Data ─────────────────────────────────────────────────────────────

export async function getReportData(opts: {
  period: "daily" | "weekly" | "monthly" | "yearly";
  date: string;
  isOwner?: boolean;
}) {
  await requireRole("OWNER", "MANAGER");

  const { start, end } = getDateRange(opts.period, opts.date);

  // Load commission settings for online vendors
  const isOwner = opts.isOwner ?? false;

  // Ledger date range is a "YYYY-MM-DD" string pair, both ends inclusive —
  // matches JournalEntry.date's string comparison (getDateRange's `end` is
  // exclusive, so back it off by 1ms before taking the date key).
  const dateFrom = localDateKey(start);
  const dateTo = localDateKey(new Date(end.getTime() - 1));

  const [
    transactions,
    cashRegisters,
    attendanceRecords,
    settings,
    staffList,
    ledgerExpenseTotals,
    ledgerPengeluaran,
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
    prisma.staff.findMany({
      where: { salary: { gt: 0 } },
      select: { id: true, name: true, salary: true },
    }),
    getLedgerExpenseTotals(dateFrom, dateTo),
    isOwner ? getLedgerPengeluaranForPeriod(dateFrom, dateTo) : Promise.resolve([]),
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

  // --- Staff salary: daily rate × present days (absent days = no pay) ---
  const presentDaysByStaff: Record<string, number> = {};
  for (const r of attendanceRecords) {
    if (r.status === "PRESENT") {
      presentDaysByStaff[r.staffId] = (presentDaysByStaff[r.staffId] ?? 0) + 1;
    }
  }
  const staffSalaryBreakdown = staffList
    .map((s) => ({
      name: s.name,
      dailySalary: s.salary!,
      presentDays: presentDaysByStaff[s.id] ?? 0,
      total: (presentDaysByStaff[s.id] ?? 0) * s.salary!,
    }))
    .filter((s) => s.presentDays > 0);
  const totalSalary = staffSalaryBreakdown.reduce((s, x) => s + x.total, 0);

  // --- Expense summary (ledger-based, Slice 3b) ---
  // opex = every Expenses:* account except Expenses:HPP:* — see
  // getLedgerExpenseTotals for why this deliberately includes
  // Expenses:OpEx:KomisiOnline and Expenses:SelisihKas (real costs).
  const totalExpenses = ledgerExpenseTotals.opex;

  // --- Cash register summary — rebuilt from the buku besar (Slice 3a's
  // formula, shared via reconcileCashDates) so laporan, tutup kas, and
  // /admin/cash-register all agree by construction instead of laporan
  // carrying its own private Expense-table reconciliation.
  const { cashByDate, nonSalesByDate } = await reconcileCashDates(cashRegisters.map((r) => r.date));
  const cashRegisterSummary = cashRegisters.map((r) => {
    const key = localDateKey(r.date);
    const cashIncome = cashByDate[key] ?? 0;
    const nonSalesCashMovement = nonSalesByDate[key] ?? 0;
    const dayExpenses = Math.max(0, -nonSalesCashMovement);
    const expectedClosing = r.openingCash + cashIncome + nonSalesCashMovement;
    return {
      date: key,
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

  // --- HPP summary (ledger-based, Slice 3b) ---
  // HPP is not a per-sale cost under Warung Books — it's the Expenses:HPP:*
  // bucket fed by pengeluaran (bahan baku purchases). Transaction.cogs has
  // been null since Slice 1 stopped writing it; the field names below
  // (cogs/grossProfit/grossMarginPct) are kept unchanged so existing
  // clients (PnLCard, export.ts) keep working.
  const totalCogs = ledgerExpenseTotals.hpp;
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
    // totalSalary/staffSalary remain an ESTIMATE (daily rate x present days)
    // for display only — they no longer feed netProfit. Under Warung Books,
    // gaji recorded as a pengeluaran already lands in totalExpenses via the
    // ledger; subtracting totalSalary here too would double-count it. If
    // gaji is never recorded as a pengeluaran, this estimate is shown but
    // not reflected in laba bersih until it is.
    totalSalary: isOwner ? totalSalary : 0,
    staffSalary: isOwner ? staffSalaryBreakdown : [],
    netProfit: isOwner ? totalRevenueCombined - totalCogs - totalExpenses : 0,
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
    expenses: isOwner ? ledgerPengeluaran : [],
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
      // Historical only — Transaction.cogs stopped being written in Slice 1
      // (dormant column); old rows may still hold real per-sale values.
      cogs: t.cogs ?? null,
    })),
    voidedCount: transactions.filter((t) => t.status === "VOIDED").length,
  };
}

export type ReportData = Awaited<ReturnType<typeof getReportData>>;
