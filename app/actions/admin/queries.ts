"use server";

import { prisma } from "@/lib/prisma";
import { requireOwner, requireRole } from "@/lib/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardData() {
  await requireOwner();

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

// ─── Staff ────────────────────────────────────────────────────────────────────

export async function getStaffWithEmails() {
  await requireOwner();

  const staffList = await prisma.staff.findMany({ orderBy: { createdAt: "asc" } });

  const supabase = createAdminClient();
  const emailMap: Record<string, string> = {};
  const linkedIds = staffList.map((s) => s.supabaseUserId).filter(Boolean) as string[];

  if (linkedIds.length > 0) {
    const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (data?.users) {
      for (const u of data.users) {
        if (linkedIds.includes(u.id)) emailMap[u.id] = u.email ?? "";
      }
    }
  }

  return staffList.map((s) => ({
    id: s.id,
    username: s.username,
    name: s.name,
    role: s.role as "OWNER" | "MANAGER" | "CASHIER" | "STAFF",
    isActive: s.isActive,
    supabaseUserId: s.supabaseUserId,
    supabaseEmail: s.supabaseUserId ? (emailMap[s.supabaseUserId] ?? null) : null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function getSessionsData() {
  await requireOwner();

  const supabase = createAdminClient();
  const [{ data, error }, staff] = await Promise.all([
    supabase.auth.admin.listUsers({ perPage: 1000 }),
    prisma.staff.findMany({ select: { name: true, role: true, supabaseUserId: true } }),
  ]);

  const staffBySupabaseId = Object.fromEntries(
    staff.filter((s) => s.supabaseUserId).map((s) => [s.supabaseUserId!, s])
  );

  const users = (data?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? "(no email)",
    lastSignIn: u.last_sign_in_at ?? null,
    staffName: staffBySupabaseId[u.id]?.name ?? null,
    staffRole: staffBySupabaseId[u.id]?.role ?? null,
  }));

  return { users, error: error?.message ?? null };
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export async function getInventoryData() {
  await requireOwner();

  const [categories, menuItems, variants, packages, packageItems] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.menuItem.findMany({
      orderBy: { name: "asc" },
      include: { category: { select: { name: true } } },
    }),
    prisma.menuVariant.findMany({
      orderBy: { label: "asc" },
      include: { menuItem: { select: { name: true } } },
    }),
    prisma.package.findMany({ orderBy: { name: "asc" } }),
    prisma.packageItem.findMany({
      include: {
        menuItem: { select: { name: true } },
        variant: { select: { label: true } },
      },
    }),
  ]);

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
    menuItems: menuItems.map((m) => ({
      id: m.id,
      name: m.name,
      categoryId: m.categoryId,
      categoryName: m.category.name,
      price: m.price,
      isHidden: m.isHidden,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
    variants: variants.map((v) => ({
      id: v.id,
      menuItemId: v.menuItemId,
      menuItemName: v.menuItem.name,
      label: v.label,
      priceModifier: v.priceModifier,
    })),
    packages: packages.map((p) => ({
      id: p.id,
      name: p.name,
      bundlePrice: p.bundlePrice,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    packageItems: packageItems.map((pi) => ({
      id: pi.id,
      packageId: pi.packageId,
      menuItemId: pi.menuItemId,
      variantId: pi.variantId,
      nameSnapshot: pi.nameSnapshot,
      menuItemName: pi.menuItem.name,
      variantLabel: pi.variant?.label ?? null,
    })),
  };
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function getTransactionsData(opts: {
  page: number;
  method: string;
  status: string;
  from: string;
  to: string;
}) {
  await requireOwner();

  const PAGE_SIZE = 20;
  const where: {
    paymentMethod?: "CASH" | "QRIS";
    status?: "PAID" | "VOIDED";
    paidAt?: { gte?: Date; lt?: Date };
  } = {};

  if (opts.method) where.paymentMethod = opts.method as "CASH" | "QRIS";
  if (opts.status) where.status = opts.status as "PAID" | "VOIDED";
  if (opts.from || opts.to) {
    where.paidAt = {};
    if (opts.from) where.paidAt.gte = new Date(opts.from);
    if (opts.to) {
      const toDate = new Date(opts.to);
      toDate.setDate(toDate.getDate() + 1);
      where.paidAt.lt = toDate;
    }
  }

  const [total, transactions] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { paidAt: "desc" },
      skip: (opts.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        processedBy: { select: { name: true } },
        voidedBy: { select: { name: true } },
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
    }),
  ]);

  return {
    total,
    totalPages: Math.ceil(total / PAGE_SIZE),
    rows: transactions.map((t) => ({
      id: t.id,
      sessionName: t.tableSession.name,
      service: t.tableSession.service as string | null,
      totalAmount: t.totalAmount,
      subtotal: t.subtotal,
      taxAmount: t.taxAmount,
      serviceCharge: t.serviceCharge,
      cashAmount: t.cashAmount,
      qrisAmount: t.qrisAmount,
      paymentMethod: t.paymentMethod as string,
      status: t.status as string,
      paidAt: t.paidAt.toISOString(),
      processedBy: t.processedBy?.name ?? null,
      voidedBy: t.voidedBy?.name ?? null,
      voidedAt: t.voidedAt?.toISOString() ?? null,
      voidReason: t.voidReason ?? null,
      orderItems: t.tableSession.orderItems.map((oi) => ({
        nameSnapshot: oi.nameSnapshot,
        qty: oi.qty,
        price: oi.price,
        status: oi.status as string,
      })),
    })),
  };
}

// ─── Transaction Detail ──────────────────────────────────────────────────────

export async function getTransactionDetail(transactionId: string) {
  await requireOwner();

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      processedBy: { select: { name: true } },
      voidedBy: { select: { name: true } },
      tableSession: {
        include: {
          orderItems: {
            orderBy: { createdAt: "asc" },
          },
          owner: { select: { name: true } },
        },
      },
    },
  });

  if (!tx) return null;

  return {
    id: tx.id,
    subtotal: tx.subtotal,
    taxAmount: tx.taxAmount,
    serviceCharge: tx.serviceCharge,
    discountAmount: tx.discountAmount,
    totalAmount: tx.totalAmount,
    cashAmount: tx.cashAmount,
    qrisAmount: tx.qrisAmount,
    paymentMethod: tx.paymentMethod as string,
    status: tx.status as string,
    paidAt: tx.paidAt.toISOString(),
    createdAt: tx.createdAt.toISOString(),
    processedBy: tx.processedBy?.name ?? null,
    voidedBy: tx.voidedBy?.name ?? null,
    voidedAt: tx.voidedAt?.toISOString() ?? null,
    voidReason: tx.voidReason ?? null,
    session: {
      id: tx.tableSession.id,
      name: tx.tableSession.name,
      service: tx.tableSession.service as string | null,
      customerAlias: tx.tableSession.customerAlias,
      customerPhone: tx.tableSession.customerPhone,
      ownerName: tx.tableSession.owner?.name ?? null,
    },
    orderItems: tx.tableSession.orderItems.map((oi) => ({
      id: oi.id,
      nameSnapshot: oi.nameSnapshot,
      qty: oi.qty,
      price: oi.price,
      note: oi.note,
      status: oi.status as string,
    })),
  };
}

export type TransactionDetail = NonNullable<Awaited<ReturnType<typeof getTransactionDetail>>>;

// ─── Cash Register ───────────────────────────────────────────────────────────

export async function getCashRegisterData(opts: { from: string; to: string }) {
  await requireRole("OWNER", "MANAGER", "CASHIER");

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  // Date filter for history
  const where: { date?: { gte?: Date; lt?: Date } } = {};
  if (opts.from || opts.to) {
    where.date = {};
    if (opts.from) where.date.gte = new Date(opts.from);
    if (opts.to) {
      const toDate = new Date(opts.to);
      toDate.setDate(toDate.getDate() + 1);
      where.date.lt = toDate;
    }
  }

  const [todayRegister, registers] = await Promise.all([
    prisma.cashRegister.findUnique({ where: { date: startOfToday } }),
    prisma.cashRegister.findMany({ where, orderBy: { date: "desc" }, take: 50 }),
  ]);

  // Compute date range for reconciliation batch queries
  const allDates = registers.map((r) => r.date);
  if (todayRegister && !allDates.some((d) => d.getTime() === startOfToday.getTime())) {
    allDates.push(startOfToday);
  }

  let cashByDate: Record<string, number> = {};
  let expenseByDate: Record<string, number> = {};

  if (allDates.length > 0) {
    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())) + 24 * 60 * 60 * 1000);

    const [transactions, expenses] = await Promise.all([
      prisma.transaction.findMany({
        where: { status: "PAID", paidAt: { gte: minDate, lt: maxDate } },
        select: { cashAmount: true, paidAt: true },
      }),
      prisma.expense.findMany({
        where: { recordedAt: { gte: minDate, lt: maxDate } },
        select: { amount: true, recordedAt: true },
      }),
    ]);

    // Bucket by date key
    for (const t of transactions) {
      const key = t.paidAt.toISOString().slice(0, 10);
      cashByDate[key] = (cashByDate[key] ?? 0) + t.cashAmount;
    }
    for (const e of expenses) {
      const key = e.recordedAt.toISOString().slice(0, 10);
      expenseByDate[key] = (expenseByDate[key] ?? 0) + e.amount;
    }
  }

  function reconcile(r: { openingCash: number; closingCash: number | null; date: Date }) {
    const key = r.date.toISOString().slice(0, 10);
    const cashIncome = cashByDate[key] ?? 0;
    const totalExpenses = expenseByDate[key] ?? 0;
    const expectedClosing = r.openingCash + cashIncome - totalExpenses;
    const difference = r.closingCash !== null ? r.closingCash - expectedClosing : null;
    return { cashIncome, totalExpenses, expectedClosing, difference };
  }

  const todayRecon = todayRegister ? reconcile(todayRegister) : null;

  return {
    todayRegister: todayRegister
      ? {
          id: todayRegister.id,
          date: todayRegister.date.toISOString(),
          openingCash: todayRegister.openingCash,
          closingCash: todayRegister.closingCash,
          isOpen: todayRegister.closingCash === null,
        }
      : null,
    todayCashIncome: todayRecon?.cashIncome ?? 0,
    todayExpenses: todayRecon?.totalExpenses ?? 0,
    todayExpectedClosing: todayRecon?.expectedClosing ?? 0,
    registers: registers.map((r) => {
      const recon = reconcile(r);
      return {
        id: r.id,
        date: r.date.toISOString(),
        openingCash: r.openingCash,
        closingCash: r.closingCash,
        cashIncome: recon.cashIncome,
        totalExpenses: recon.totalExpenses,
        expectedClosing: recon.expectedClosing,
        difference: recon.difference,
      };
    }),
  };
}

// ─── Attendance ──────────────────────────────────────────────────────────────

export async function getAttendanceData(opts: { date: string }) {
  await requireRole("OWNER", "MANAGER");

  let targetDate: Date;
  if (opts.date) {
    // Parse YYYY-MM-DD as local date (not UTC)
    const [y, m, d] = opts.date.split("-").map(Number);
    targetDate = new Date(y, m - 1, d);
  } else {
    const now = new Date();
    targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const [activeStaffList, records] = await Promise.all([
    prisma.staff.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.attendanceRecord.findMany({ where: { date: targetDate } }),
  ]);

  const recordMap = new Map(records.map((r) => [r.staffId, r]));

  const staffAttendance = activeStaffList.map((s) => {
    const record = recordMap.get(s.id);
    return {
      staffId: s.id,
      staffName: s.name,
      role: s.role as string,
      status: (record?.status as "PRESENT" | "ABSENT") ?? null,
      recordId: record?.id ?? null,
    };
  });

  const present = staffAttendance.filter((s) => s.status === "PRESENT").length;
  const absent = staffAttendance.filter((s) => s.status === "ABSENT").length;

  // Format date as local YYYY-MM-DD (not toISOString which converts to UTC)
  const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;

  return {
    date: dateStr,
    staffAttendance,
    summary: {
      total: staffAttendance.length,
      present,
      absent,
      unmarked: staffAttendance.length - present - absent,
    },
  };
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export async function getExpensesData(opts: { from: string; to: string }) {
  await requireOwner();

  const where: { recordedAt?: { gte?: Date; lt?: Date } } = {};
  if (opts.from || opts.to) {
    where.recordedAt = {};
    if (opts.from) where.recordedAt.gte = new Date(opts.from);
    if (opts.to) {
      const toDate = new Date(opts.to);
      toDate.setDate(toDate.getDate() + 1);
      where.recordedAt.lt = toDate;
    }
  }

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({ where, orderBy: { recordedAt: "desc" }, take: 50 }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
  ]);

  return {
    expenses: expenses.map((e) => ({
      id: e.id,
      amount: e.amount,
      note: e.note,
      recordedAt: e.recordedAt.toISOString(),
      createdAt: e.createdAt.toISOString(),
    })),
    totalAmount: total._sum.amount ?? 0,
  };
}

// ─── Reports ──────────────────────────────────────────────────────────────────

function getDateRange(period: "daily" | "weekly" | "monthly", dateStr: string) {
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

  // monthly
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { start, end };
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function getReportData(opts: {
  period: "daily" | "weekly" | "monthly";
  date: string;
}) {
  await requireRole("OWNER", "MANAGER");

  const { start, end } = getDateRange(opts.period, opts.date);

  const [
    transactions,
    expenses,
    cashRegisters,
    attendanceRecords,
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
    }),
    prisma.cashRegister.findMany({
      where: { date: { gte: start, lt: end } },
      orderBy: { date: "desc" },
    }),
    prisma.attendanceRecord.findMany({
      where: { date: { gte: start, lt: end } },
      include: { staff: { select: { name: true } } },
    }),
  ]);

  // --- Revenue summary ---
  const paidTx = transactions.filter((t) => t.status === "PAID");
  const totalRevenue = paidTx.reduce((s, t) => s + t.totalAmount, 0);
  const totalTransactions = paidTx.length;
  const avgTransaction = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;

  // --- Revenue by day ---
  const revenueByDayMap: Record<string, { revenue: number; count: number }> = {};
  for (const t of paidTx) {
    const key = localDateKey(t.paidAt);
    if (!revenueByDayMap[key]) revenueByDayMap[key] = { revenue: 0, count: 0 };
    revenueByDayMap[key].revenue += t.totalAmount;
    revenueByDayMap[key].count += 1;
  }
  // Fill all days in range
  const revenueByDay: { date: string; revenue: number; count: number }[] = [];
  const cursor = new Date(start);
  while (cursor < end) {
    const key = localDateKey(cursor);
    revenueByDay.push({ date: key, ...(revenueByDayMap[key] ?? { revenue: 0, count: 0 }) });
    cursor.setDate(cursor.getDate() + 1);
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

  // --- Service channel breakdown ---
  const serviceMap: Record<string, { amount: number; count: number }> = {};
  for (const t of paidTx) {
    const svc = (t.tableSession.service as string) ?? "Dine In";
    if (!serviceMap[svc]) serviceMap[svc] = { amount: 0, count: 0 };
    serviceMap[svc].amount += t.totalAmount;
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
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  // --- Cash register summary ---
  // Reuse reconciliation pattern
  const cashByDate: Record<string, number> = {};
  const expenseByDate: Record<string, number> = {};
  for (const t of paidTx) {
    const key = localDateKey(t.paidAt);
    cashByDate[key] = (cashByDate[key] ?? 0) + t.cashAmount;
  }
  for (const e of expenses) {
    const key = localDateKey(e.recordedAt);
    expenseByDate[key] = (expenseByDate[key] ?? 0) + e.amount;
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

  return {
    period: opts.period,
    dateRange: { start: localDateKey(start), end: localDateKey(new Date(end.getTime() - 1)) },
    revenue: { total: totalRevenue, count: totalTransactions, average: avgTransaction },
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
    revenueByDay,
    paymentMethods,
    serviceChannels,
    topItems,
    cashRegisterSummary,
    attendanceSummary,
    expenses: expenses.map((e) => ({
      id: e.id,
      amount: e.amount,
      note: e.note,
      recordedAt: e.recordedAt.toISOString(),
    })),
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
