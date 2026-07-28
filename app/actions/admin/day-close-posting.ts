"use server";

/**
 * day-close-posting.ts — shared "post at close" helper (Slice 3a wiring).
 *
 * Every seam that changes a closed register's day-close facts (close itself,
 * edit, void of a transaction, delete of the register) funnels through
 * postDayCloseForRegister so the posting logic — and its non-blocking
 * failure policy — lives in exactly one place.
 *
 * Non-blocking by design: a cashier closing the register must NEVER be
 * blocked because the owner hasn't finished the accounting setup (mapping
 * sales-channel accounts) or because the month is locked. Those failures are
 * caught here, the owners are notified, and {posted:false, reason} is
 * returned instead of throwing. Any other error is a real bug and propagates.
 */

import { prisma } from "@/lib/prisma";
import { localDateKey } from "@/lib/format";
import { sumDaySales, type DaySalesInput } from "@/lib/day-close";
import {
  SalesPostingRepository,
  DayCloseAlreadyPostedError,
} from "@/lib/accounting/salesPostingRepository";
import {
  SalesChannelRepository,
  ChannelAccountNotSetError,
} from "@/lib/accounting/salesChannelRepository";
import { PeriodLockedError } from "@/lib/accounting/accountingRepository";
import { getNonSalesCashMovementByDate } from "@/app/actions/admin/queries/ledger-cash-queries";

export async function postDayCloseForRegister(
  cashRegisterId: string,
  opts?: { repost?: boolean },
): Promise<{ posted: boolean; reason?: string }> {
  const register = await prisma.cashRegister.findUnique({ where: { id: cashRegisterId } });
  if (!register) return { posted: false, reason: "Data kas tidak ditemukan." };
  if (register.closingCash === null) return { posted: false, reason: "Kas hari ini belum ditutup." };

  const date = localDateKey(register.date);

  try {
    const accounts = await new SalesChannelRepository(prisma).require(["tunai", "elektronik"]);

    const dayStart = register.date;
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const transactions = await prisma.transaction.findMany({
      where: { status: "PAID", paidAt: { gte: dayStart, lt: dayEnd } },
      select: {
        paymentMethod: true,
        cashAmount: true,
        qrisAmount: true,
        totalAmount: true,
        tableSession: { select: { service: true } },
      },
    });

    const inputs: DaySalesInput[] = transactions.map((t) => ({
      paymentMethod: t.paymentMethod,
      cashAmount: t.cashAmount,
      qrisAmount: t.qrisAmount,
      totalAmount: t.totalAmount,
      service: t.tableSession.service,
    }));
    const { cashSales, qrisSales } = sumDaySales(inputs);

    const nonSalesByDate = await getNonSalesCashMovementByDate(accounts.tunai, [date]);
    const nonSalesCashMovement = nonSalesByDate[date] ?? 0;
    const expectedCash = register.openingCash + cashSales + nonSalesCashMovement;

    const spec = {
      date,
      cashRegisterId: register.id,
      cashSales: BigInt(cashSales),
      qrisSales: BigInt(qrisSales),
      expectedCash: BigInt(expectedCash),
      countedCash: BigInt(register.closingCash),
      tunaiAccount: accounts.tunai,
      elektronikAccount: accounts.elektronik,
    };

    const sales = new SalesPostingRepository(prisma);
    if (opts?.repost) {
      await sales.repostDayClose(spec);
    } else {
      await sales.postDayClose(spec);
    }
    return { posted: true };
  } catch (e) {
    if (e instanceof DayCloseAlreadyPostedError) {
      // Non-repost double-close race — already done, nothing to surface.
      return { posted: true };
    }
    if (e instanceof ChannelAccountNotSetError || e instanceof PeriodLockedError) {
      // Deliberately NOT a Notification row: NotificationType has no value that
      // fits a ledger-posting failure, and reusing "TEST" would show the owner a
      // TEST badge for a real problem. The recovery path is the "Belum tercatat
      // ke buku besar" badge + "Catat ke buku besar" button on
      // /admin/cash-register, which reads LedgerPosting directly. Add a proper
      // enum value via an additive migration before turning this into a
      // notification.
      const reason = e.message;
      console.warn(`[day-close] ${date} not posted to the ledger: ${reason}`);
      return { posted: false, reason };
    }
    throw e;
  }
}
