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
      orderItems: t.tableSession.orderItems.map((oi) => ({
        nameSnapshot: oi.nameSnapshot,
        qty: oi.qty,
        price: oi.price,
        status: oi.status as string,
      })),
    })),
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
