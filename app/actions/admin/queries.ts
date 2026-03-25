"use server";

import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
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
    paymentMethod?: "CASH" | "DYNAMIC_QRIS" | "STATIC_QRIS";
    status?: "PAID" | "VOIDED";
    paidAt?: { gte?: Date; lt?: Date };
  } = {};

  if (opts.method) where.paymentMethod = opts.method as "CASH" | "DYNAMIC_QRIS" | "STATIC_QRIS";
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

// ─── Cash Register ───────────────────────────────────────────────────────────

export async function getCashRegisterData(opts: { from: string; to: string }) {
  await requireOwner();

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
  await requireOwner();

  const targetDate = opts.date ? new Date(opts.date) : new Date();
  targetDate.setHours(0, 0, 0, 0);

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

  return {
    date: targetDate.toISOString().slice(0, 10),
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
