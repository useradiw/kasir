"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { runAction } from "@/lib/action-error";
import { revalidateKeuangan } from "@/lib/revalidate";
import { ExpenseRepository } from "@/lib/accounting/expenseRepository";
import { CatatRepository, type CatatSourceType } from "@/lib/accounting/catatRepository";
import { CashAccountRepository } from "@/lib/accounting/cashAccountRepository";
import { MonthRepository } from "@/lib/accounting/monthRepository";
import { SalesChannelRepository } from "@/lib/accounting/salesChannelRepository";
import { seedChartOfAccounts } from "@/lib/accounting/chart-of-accounts";
import { SELECTED_MONTH_COOKIE } from "@/lib/keuangan-month";
import {
  categorySchema,
  updateCategorySchema,
  pengeluaranSchema,
  transferSchema,
  modalSchema,
  priveSchema,
  saldoAwalSchema,
  cashAccountSchema,
  renameCashAccountSchema,
  setCashAccountActiveSchema,
  salesChannelAccountSchema,
  monthSchema,
  type CategoryData,
  type PengeluaranData,
  type TransferData,
  type ModalData,
  type PriveData,
  type SaldoAwalData,
} from "@/lib/keuangan-schema";

const expenses = () => new ExpenseRepository(prisma);
const catat = () => new CatatRepository(prisma);
const cash = () => new CashAccountRepository(prisma);
const months = () => new MonthRepository(prisma);
const salesChannels = () => new SalesChannelRepository(prisma);

async function setSelectedMonthCookie(month: string) {
  const store = await cookies();
  store.set(SELECTED_MONTH_COOKIE, month, { path: "/", maxAge: 60 * 60 * 24 * 365 });
}

// ---------------------------------------------------------------------------
// Kategori pengeluaran
// ---------------------------------------------------------------------------

export async function createCategory(data: CategoryData) {
  return runAction(async () => {
    await requireOwner();
    const parsed = categorySchema.parse(data);
    const row = await expenses().createCategory(parsed);
    revalidateKeuangan();
    return { id: row.id };
  });
}

export async function updateCategory(input: { id: string; name?: string; active?: boolean }) {
  return runAction(async () => {
    await requireOwner();
    const { id, ...rest } = updateCategorySchema.parse(input);
    await expenses().updateCategory(id, rest);
    revalidateKeuangan();
  });
}

export async function seedDefaultCategories() {
  return runAction(async () => {
    await requireOwner();
    await expenses().ensureDefaultCategories();
    revalidateKeuangan();
  });
}

export async function deleteCategory(id: string) {
  return runAction(async () => {
    await requireOwner();
    await expenses().deleteCategory(id);
    revalidateKeuangan();
  });
}

// ---------------------------------------------------------------------------
// Pengeluaran
// ---------------------------------------------------------------------------

export async function recordPengeluaran(data: PengeluaranData) {
  return runAction(async () => {
    const staff = await requireOwner();
    const parsed = pengeluaranSchema.parse(data);
    const row = await expenses().recordPengeluaran({
      date: parsed.date,
      akun: parsed.akun,
      item: parsed.item,
      qty: parsed.qty,
      hargaSatuan: BigInt(parsed.hargaSatuan),
      jumlah: BigInt(parsed.jumlah),
      kategoriCode: parsed.kategoriCode,
      createdBy: staff.id,
    });
    revalidateKeuangan();
    return { id: row.id };
  });
}

export async function voidPengeluaran(id: string) {
  return runAction(async () => {
    await requireOwner();
    await expenses().voidPengeluaran(id);
    revalidateKeuangan();
  });
}

// ---------------------------------------------------------------------------
// Catat siblings — Transfer / Modal / Prive / Saldo Awal
// ---------------------------------------------------------------------------

export async function recordTransfer(data: TransferData) {
  return runAction(async () => {
    await requireOwner();
    const parsed = transferSchema.parse(data);
    const row = await catat().recordTransfer({
      date: parsed.date,
      dari: parsed.dari,
      ke: parsed.ke,
      jumlah: BigInt(parsed.jumlah),
      catatan: parsed.catatan,
    });
    revalidateKeuangan();
    return { id: row.id };
  });
}

export async function recordModal(data: ModalData) {
  return runAction(async () => {
    await requireOwner();
    const parsed = modalSchema.parse(data);
    const row = await catat().recordModal({
      date: parsed.date,
      nama: parsed.nama,
      akun: parsed.akun,
      jumlah: BigInt(parsed.jumlah),
      catatan: parsed.catatan,
    });
    revalidateKeuangan();
    return { id: row.id };
  });
}

export async function recordPrive(data: PriveData) {
  return runAction(async () => {
    await requireOwner();
    const parsed = priveSchema.parse(data);
    const row = await catat().recordPrive({
      date: parsed.date,
      akun: parsed.akun,
      jumlah: BigInt(parsed.jumlah),
      catatan: parsed.catatan,
    });
    revalidateKeuangan();
    return { id: row.id };
  });
}

export async function recordSaldoAwal(data: SaldoAwalData) {
  return runAction(async () => {
    await requireOwner();
    const parsed = saldoAwalSchema.parse(data);
    const { row, hasPriorEntries } = await catat().recordSaldoAwal({
      date: parsed.date,
      akun: parsed.akun,
      jumlah: BigInt(parsed.jumlah),
    });
    revalidateKeuangan();
    return { id: row.id, hasPriorEntries };
  });
}

export async function voidCatat(id: string, sourceType: CatatSourceType) {
  return runAction(async () => {
    await requireOwner();
    await catat().voidCatat(id, sourceType);
    revalidateKeuangan();
  });
}

// ---------------------------------------------------------------------------
// Akun kas (cash-account registry)
// ---------------------------------------------------------------------------

export async function createCashAccount(input: { label: string }) {
  return runAction(async () => {
    await requireOwner();
    const parsed = cashAccountSchema.parse(input);
    const row = await cash().create(parsed.label);
    revalidateKeuangan();
    return { id: row.id };
  });
}

export async function renameCashAccount(input: { id: string; label: string }) {
  return runAction(async () => {
    await requireOwner();
    const parsed = renameCashAccountSchema.parse(input);
    await cash().rename(parsed.id, parsed.label);
    revalidateKeuangan();
  });
}

export async function setCashAccountActive(input: { id: string; active: boolean }) {
  return runAction(async () => {
    await requireOwner();
    const parsed = setCashAccountActiveSchema.parse(input);
    await cash().setActive(parsed.id, parsed.active);
    revalidateKeuangan();
  });
}

// ---------------------------------------------------------------------------
// Akun penjualan (sales-channel -> kas account mapping)
// ---------------------------------------------------------------------------

export async function setSalesChannelAccount(input: { channel: string; account: string }) {
  return runAction(async () => {
    await requireOwner();
    const parsed = salesChannelAccountSchema.parse(input);
    await salesChannels().set(parsed.channel, parsed.account);
    revalidateKeuangan();
  });
}

/** Idempotent — seeds the structural chart of accounts (sales/HPP/equity roots)
 *  that the posting seams reference by name. Safe to click repeatedly. */
export async function seedStructuralChart() {
  return runAction(async () => {
    await requireOwner();
    await seedChartOfAccounts(prisma);
    revalidateKeuangan();
  });
}

// ---------------------------------------------------------------------------
// Bulan (accounting months) — creation + active-month selection
// ---------------------------------------------------------------------------

export async function createMonth(input: { month: string }) {
  return runAction(async () => {
    await requireOwner();
    const { month } = monthSchema.parse(input);
    await months().create(month);
    await setSelectedMonthCookie(month);
    revalidateKeuangan();
  });
}

export async function setSelectedMonth(input: { month: string }) {
  return runAction(async () => {
    await requireOwner();
    const { month } = monthSchema.parse(input);
    await setSelectedMonthCookie(month);
    revalidateKeuangan();
  });
}
