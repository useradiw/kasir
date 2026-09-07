"use server";

import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/admin-auth";
import { ExpenseRepository } from "@/lib/accounting/expenseRepository";
import { CatatRepository, type CatatSourceType } from "@/lib/accounting/catatRepository";
import { CashAccountRepository } from "@/lib/accounting/cashAccountRepository";
import { MonthRepository } from "@/lib/accounting/monthRepository";
import { SalesChannelRepository } from "@/lib/accounting/salesChannelRepository";

/** Amounts fit safely in Number (Rupiah < 2^53); convert at the read boundary
 *  so BigInt never crosses the server/client serialization seam. */
const n = (b: bigint) => Number(b);

export type DateRange = { dateFrom?: string; dateTo?: string };

export interface JurnalRow {
  id: string;
  number: number | null;
  date: string;
  narration: string;
  state: string;
  sourceType: string | null;
  lines: { account: string; amount: number }[];
}

/** Raw jurnal list (the Keuangan landing). Newest first; VOID hidden by default. */
export async function listJurnal(opts: DateRange & { includeVoid?: boolean } = {}): Promise<JurnalRow[]> {
  await requireCan("buku.read");
  const where: {
    state?: { in?: ("POSTED" | "VOID")[]; not?: "VOID" };
    date?: { gte?: string; lte?: string };
  } = { state: opts.includeVoid ? { in: ["POSTED", "VOID"] } : { not: "VOID" } };
  if (opts.dateFrom || opts.dateTo) {
    where.date = {};
    if (opts.dateFrom) where.date.gte = opts.dateFrom;
    if (opts.dateTo) where.date.lte = opts.dateTo;
  }
  const entries = await prisma.journalEntry.findMany({
    where,
    include: { lines: true },
    orderBy: [{ date: "desc" }, { number: "desc" }],
  });
  return entries.map((e) => ({
    id: e.id,
    number: e.number,
    date: e.date,
    narration: e.narration,
    state: e.state,
    sourceType: e.sourceType,
    lines: e.lines.map((l) => ({ account: l.account, amount: n(l.amount) })),
  }));
}

export async function listPengeluaran(range: DateRange = {}) {
  await requireCan("buku.read");
  const rows = await new ExpenseRepository(prisma).listPengeluaran(range);
  return rows.map((r) => ({ ...r, hargaSatuan: n(r.hargaSatuan), jumlah: n(r.jumlah) }));
}

export async function listCategories() {
  await requireCan("buku.read");
  return new ExpenseRepository(prisma).listCategories();
}

export async function listCatat(sourceType: CatatSourceType, range: DateRange = {}) {
  await requireCan("buku.read");
  const rows = await new CatatRepository(prisma).listCatat(sourceType, range);
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    date: r.date,
    narration: r.narration,
    jumlah: n(r.jumlah),
    meta: r.meta,
    replacesId: r.replacesId,
  }));
}

export async function listCashAccounts(includeInactive = false) {
  await requireCan("buku.read");
  return new CashAccountRepository(prisma).list(includeInactive);
}

export async function listMonths() {
  await requireCan("buku.read");
  return new MonthRepository(prisma).list();
}

/** Every sales channel ("tunai"/"elektronik"/"online") -> mapped kas account,
 *  or null when unmapped. Backs the Akun Penjualan screen. */
export async function listSalesChannelAccounts() {
  await requireCan("buku.read");
  return new SalesChannelRepository(prisma).list();
}
