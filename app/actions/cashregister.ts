"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { Staff } from "@/generated/prisma";

const LOCK_HOURS = 7;

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function getStaffFromSession(): Promise<Staff> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const staff = await prisma.staff.findUnique({
    where: { supabaseUserId: user.id },
  });

  if (!staff || !staff.isActive) redirect("/");

  return staff;
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const openSchema = z.object({
  openingCash: z.coerce.number().int().min(0, "Kas awal tidak boleh negatif"),
});

const closeSchema = z.object({
  closingCash: z.coerce.number().int().min(0, "Kas akhir tidak boleh negatif"),
});

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function openRegisterForStaff(formData: FormData) {
  const staff = await getStaffFromSession();

  const parsed = openSchema.safeParse({ openingCash: formData.get("openingCash") });
  if (!parsed.success) throw new Error(Object.values(parsed.error.flatten().fieldErrors).flat()[0]);

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const existing = await prisma.cashRegister.findUnique({ where: { date: todayMidnight } });
  if (existing) throw new Error("Kas hari ini sudah dibuka.");

  await prisma.cashRegister.create({
    data: {
      date: todayMidnight,
      openingCash: parsed.data.openingCash,
      openedById: staff.id,
    },
  });
  revalidatePath("/cashregister");
  revalidatePath("/admin/cash-register");
}

export async function closeRegisterForStaff(formData: FormData) {
  const staff = await getStaffFromSession();

  const parsed = closeSchema.safeParse({ closingCash: formData.get("closingCash") });
  if (!parsed.success) throw new Error(Object.values(parsed.error.flatten().fieldErrors).flat()[0]);

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const register = await prisma.cashRegister.findUnique({ where: { date: todayMidnight } });
  if (!register) throw new Error("Kas hari ini belum dibuka.");
  if (register.closingCash !== null) throw new Error("Kas hari ini sudah ditutup.");

  // 7-hour lock check
  const lockExpiry = new Date(register.createdAt.getTime() + LOCK_HOURS * 60 * 60 * 1000);
  if (now < lockExpiry) {
    const remaining = lockExpiry.getTime() - now.getTime();
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.ceil((remaining % (60 * 60 * 1000)) / (60 * 1000));
    throw new Error(`Kas masih terkunci. Bisa ditutup dalam ${hours} jam ${minutes} menit.`);
  }

  await prisma.cashRegister.update({
    where: { id: register.id },
    data: {
      closingCash: parsed.data.closingCash,
      closedById: staff.id,
    },
  });
  revalidatePath("/cashregister");
  revalidatePath("/admin/cash-register");
}

// ─── Query ───────────────────────────────────────────────────────────────────

export async function getCashRegisterDataForStaff(opts: { from: string; to: string }) {
  await getStaffFromSession();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

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
    prisma.cashRegister.findUnique({
      where: { date: startOfToday },
      include: {
        openedBy: { select: { name: true } },
        closedBy: { select: { name: true } },
      },
    }),
    prisma.cashRegister.findMany({
      where,
      orderBy: { date: "desc" },
      take: 50,
      include: {
        openedBy: { select: { name: true } },
        closedBy: { select: { name: true } },
      },
    }),
  ]);

  // Reconciliation (same logic as admin query)
  const allDates = registers.map((r) => r.date);
  if (todayRegister && !allDates.some((d) => d.getTime() === startOfToday.getTime())) {
    allDates.push(startOfToday);
  }

  const cashByDate: Record<string, number> = {};
  const expenseByDate: Record<string, number> = {};

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
        include: { items: { select: { amount: true, cost: true } } },
      }),
    ]);

    for (const t of transactions) {
      const key = t.paidAt.toISOString().slice(0, 10);
      cashByDate[key] = (cashByDate[key] ?? 0) + t.cashAmount;
    }
    for (const e of expenses) {
      const key = e.recordedAt.toISOString().slice(0, 10);
      const total = e.items.reduce((s, i) => s + i.amount * i.cost, 0);
      expenseByDate[key] = (expenseByDate[key] ?? 0) + total;
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
          createdAt: todayRegister.createdAt.toISOString(),
          openedByName: todayRegister.openedBy?.name ?? null,
          closedByName: todayRegister.closedBy?.name ?? null,
        }
      : null,
    todayCashIncome: todayRecon?.cashIncome ?? 0,
    todayExpenses: todayRecon?.totalExpenses ?? 0,
    todayExpectedClosing: todayRecon?.expectedClosing ?? 0,
    lockHours: LOCK_HOURS,
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
        openedByName: r.openedBy?.name ?? null,
        closedByName: r.closedBy?.name ?? null,
      };
    }),
  };
}
