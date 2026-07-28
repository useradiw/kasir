/**
 * chart-of-accounts.ts — kasir's Warung Books chart of accounts (Slice 0).
 *
 * The LedgerAccount table is a REGISTRY (backs UI dropdowns / validation); the
 * ledger itself derives balances from JournalLine account-name strings, never
 * from FKs into this table. So this seed is safe to run/re-run at any time and
 * is not on the money path.
 *
 * Accounting decisions (Warung Books defaults — cash-basis, expense-on-purchase,
 * no capitalized inventory): kasir's cost of goods is bahan baku (ingredients).
 * HPP is an expense bucket fed by bahan baku purchases recorded as Pengeluaran,
 * NOT by a per-sale cost (kasir has no hargaModal concept — that is a
 * tokokencana retail-goods idea). Structure:
 *   Assets:Cash:*   ·  Income:Sales:{Tunai,QRIS,Online}
 *   Expenses:HPP:*  ·  Expenses:OpEx:*  ·  Equity:*  ·  SelisihKas (cash-drawer
 *   over/short from kasir shift closes — used from a later slice)
 */

import type { PrismaClient, AccountType } from "@/generated/prisma";

export interface ChartAccountSeed {
  /** Short stable slug, unique — e.g. "cash-utama". */
  code: string;
  /** Full Beancount-style name, unique — e.g. "Assets:Cash:Utama". */
  name: string;
}

/** Map a Beancount root segment to the Prisma AccountType enum. */
export function accountTypeFor(name: string): AccountType {
  const root = name.split(":", 1)[0] ?? "";
  switch (root) {
    case "Assets":
      return "ASSET";
    case "Liabilities":
      return "LIABILITY";
    case "Equity":
      return "EQUITY";
    case "Income":
      return "INCOME";
    case "Expenses":
      return "EXPENSE";
    default:
      throw new Error(`Unknown account root in "${name}"`);
  }
}

/**
 * Minimal STRUCTURAL starter accounts — only the ones the automated posting
 * seams reference by name (sales-tender split, HPP, equity). Everything else,
 * including your real cash/bank accounts and any income/expense account, is
 * created freely in the account registry (Slice 1); the registry is fully
 * user-extensible and this seed never deletes or constrains it. Cash accounts
 * are deliberately NOT seeded — you define your own.
 */
export const KASIR_CHART_OF_ACCOUNTS: readonly ChartAccountSeed[] = [
  // Pendapatan — sales split by tender (cash-basis; auto-post seam, Slice 2)
  { code: "sales-tunai", name: "Income:Sales:Tunai" },
  { code: "sales-qris", name: "Income:Sales:QRIS" },
  { code: "sales-online", name: "Income:Sales:Online" },

  // HPP — cost of goods sold, fed by bahan baku purchases recorded as
  // Pengeluaran (never a per-sale cost)
  { code: "hpp-bahan", name: "Expenses:HPP:Bahan" },

  // OpEx — fed by online-settlement commission + deductions (Slice 3a)
  { code: "opex-komisi-online", name: "Expenses:OpEx:KomisiOnline" },

  // Ekuitas — Modal / Saldo Awal / Prive screens (Slice 1 & 5)
  { code: "equity-modal", name: "Equity:Modal" },
  { code: "equity-opening", name: "Equity:Opening" },
  { code: "equity-prive", name: "Equity:Prive" },

  // Selisih kas — cash-drawer over/short from kasir shift closes (later slice)
  { code: "selisih-kas-expense", name: "Expenses:SelisihKas" },
  { code: "selisih-kas-income", name: "Income:SelisihKas" },
];

/**
 * Idempotent seed of the chart of accounts. Upserts by unique `code`, so it is
 * safe to run on every deploy / boot. Never deletes existing accounts.
 */
export async function seedChartOfAccounts(prisma: PrismaClient): Promise<void> {
  for (const acct of KASIR_CHART_OF_ACCOUNTS) {
    await prisma.ledgerAccount.upsert({
      where: { code: acct.code },
      update: { name: acct.name, type: accountTypeFor(acct.name) },
      create: { code: acct.code, name: acct.name, type: accountTypeFor(acct.name) },
    });
  }
}
