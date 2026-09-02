"use server";

import { redirect } from "next/navigation";
import { revalidateCashRegister } from "@/lib/revalidate";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { Staff } from "@/generated/prisma";
import { getSetting } from "@/lib/settings";
import { ActionError, runAction } from "@/lib/action-error";
import {
  reconcileCashDates,
  reconcileRegisterDay,
  resolveRegisterPostings,
} from "@/app/actions/admin/queries/_shared";
import { postDayCloseForRegister } from "@/lib/day-close-posting";
import { SalesChannelRepository } from "@/lib/accounting/salesChannelRepository";

/** Resolves the "tunai" sales channel's kas account to a display label —
 *  same fallback getLedgerPengeluaranForPeriod uses (label || last segment
 *  of the account name). Degrades to null, never throws, when unmapped. */
async function resolveCashAccountLabel(): Promise<string | null> {
  try {
    const tunaiAccount = (await new SalesChannelRepository(prisma).list()).tunai;
    if (!tunaiAccount) return null;
    const account = await prisma.ledgerAccount.findUnique({
      where: { name: tunaiAccount },
      select: { label: true, name: true },
    });
    if (!account) return null;
    return account.label || account.name.split(":").pop() || null;
  } catch {
    return null;
  }
}

const DEFAULT_LOCK_HOURS = 4;

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
  return runAction(async () => {
    const staff = await getStaffFromSession();
    const { openingCash } = openSchema.parse({ openingCash: formData.get("openingCash") });

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const existing = await prisma.cashRegister.findUnique({ where: { date: todayMidnight } });
    if (existing) throw new ActionError("Kas hari ini sudah dibuka.");

    await prisma.cashRegister.create({
      data: { date: todayMidnight, openingCash, openedById: staff.id },
    });
    revalidateCashRegister();
  });
}

export async function closeRegisterForStaff(formData: FormData) {
  return runAction(async () => {
    const staff = await getStaffFromSession();
    const { closingCash } = closeSchema.parse({ closingCash: formData.get("closingCash") });

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const register = await prisma.cashRegister.findUnique({ where: { date: todayMidnight } });
    if (!register) throw new ActionError("Kas hari ini belum dibuka.");
    if (register.closingCash !== null) throw new ActionError("Kas hari ini sudah ditutup.");

    // Lock check (duration from settings)
    const lockHours = parseInt(await getSetting("lock_hours")) || DEFAULT_LOCK_HOURS;
    const lockExpiry = new Date(register.createdAt.getTime() + lockHours * 60 * 60 * 1000);
    if (now < lockExpiry) {
      const remaining = lockExpiry.getTime() - now.getTime();
      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const minutes = Math.ceil((remaining % (60 * 60 * 1000)) / (60 * 1000));
      throw new ActionError(`Kas masih terkunci. Bisa ditutup dalam ${hours} jam ${minutes} menit.`);
    }

    await prisma.cashRegister.update({
      where: { id: register.id },
      data: { closingCash, closedById: staff.id },
    });
    revalidateCashRegister();

    // Post to the buku besar AFTER the register is closed — a cashier must
    // never be blocked by unfinished accounting setup. Failure is swallowed
    // by postDayCloseForRegister itself (owners get notified instead).
    await postDayCloseForRegister(register.id);
  });
}

// ─── Query ───────────────────────────────────────────────────────────────────

export async function getCashRegisterDataForStaff(opts: { from: string; to: string }) {
  await getStaffFromSession();
  const lockHours = parseInt(await getSetting("lock_hours")) || DEFAULT_LOCK_HOURS;

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

  const include = {
    openedBy: { select: { name: true } },
    closedBy: { select: { name: true } },
  };

  const [todayRegister, registers, cashAccountLabel] = await Promise.all([
    prisma.cashRegister.findUnique({ where: { date: startOfToday }, include }),
    prisma.cashRegister.findMany({ where, orderBy: { date: "desc" }, take: 50, include }),
    resolveCashAccountLabel(),
  ]);

  // Reconciliation (same logic as admin query)
  const allDates = registers.map((r) => r.date);
  if (todayRegister && !allDates.some((d) => d.getTime() === startOfToday.getTime())) {
    allDates.push(startOfToday);
  }

  // Ledger-based reconciliation — the SAME shared helper the admin screen
  // uses, so tutup kas (staff view) and Kas Harian never disagree.
  const { cashByDate, qrisByDate, cashTxnCountByDate, nonSalesByDate, movementsByDate } =
    await reconcileCashDates(allDates);
  const byDate = {
    cash: cashByDate,
    qris: qrisByDate,
    nonSales: nonSalesByDate,
    cashTxnCount: cashTxnCountByDate,
    movements: movementsByDate,
  };
  const reconcile = (r: { openingCash: number; closingCash: number | null; date: Date }) =>
    reconcileRegisterDay(r, byDate);

  const todayRecon = todayRegister ? reconcile(todayRegister) : null;

  // Which closed registers already have a day-close (shift-close) posting —
  // same shared lookup the owner query uses (task A3/A4).
  const registerIds = registers.map((r) => r.id);
  if (todayRegister) registerIds.push(todayRegister.id);
  const postings = await resolveRegisterPostings(registerIds);
  const todayPosting = todayRegister ? postings.get(todayRegister.id) : undefined;

  return {
    cashAccountLabel,
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
          hasPosting:
            todayRegister.closingCash !== null
              ? (todayPosting?.posted ?? false) || (todayRecon?.nothingToPost ?? false)
              : null,
          journalNumber: todayPosting?.journalNumber ?? null,
        }
      : null,
    todayCashIncome: todayRecon?.cashIncome ?? 0,
    todayExpenses: todayRecon?.totalExpenses ?? 0,
    todayExpectedClosing: todayRecon?.expectedClosing ?? 0,
    todayQrisIncome: todayRecon?.qrisIncome ?? 0,
    todayCashTxnCount: todayRecon?.cashTxnCount ?? 0,
    todayMovements: todayRecon?.movements ?? [],
    lockHours,
    registers: registers.map((r) => {
      const recon = reconcile(r);
      const posting = postings.get(r.id);
      return {
        id: r.id,
        date: r.date.toISOString(),
        openingCash: r.openingCash,
        closingCash: r.closingCash,
        cashIncome: recon.cashIncome,
        qrisIncome: recon.qrisIncome,
        totalExpenses: recon.totalExpenses,
        expectedClosing: recon.expectedClosing,
        difference: recon.difference,
        cashTxnCount: recon.cashTxnCount,
        movements: recon.movements,
        createdAt: r.createdAt.toISOString(),
        openedByName: r.openedBy?.name ?? null,
        closedByName: r.closedBy?.name ?? null,
        hasPosting: r.closingCash !== null ? (posting?.posted ?? false) || recon.nothingToPost : null,
        journalNumber: posting?.journalNumber ?? null,
      };
    }),
  };
}
