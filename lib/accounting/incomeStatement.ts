/**
 * Laba Rugi (Income Statement) - period report.
 * Mirrors Warung Books income_statement.py.
 *
 * Pendapatan (Income)          = -S("Income:")   [credits are negative]
 * Pengeluaran Bahan Baku       = +S("Expenses:BahanBaku:")
 * Laba Kotor                   = Pendapatan - Pengeluaran Bahan Baku
 * Pengeluaran Operasional      = every other Expenses: account (see below)
 * Laba Bersih                  = Laba Kotor - Pengeluaran Operasional
 */

import { Book } from "./book";

/**
 * Friendly labels for expense accounts that are NOT backed by an
 * ExpenseCategory, so `cats` can never supply a name for them. Without this
 * they render as a bare code like "SelisihKas".
 */
const NON_CATEGORY_LABELS: Readonly<Record<string, string>> = {
  "Expenses:SelisihKas": "Selisih Kas",
  "Expenses:KasKeluar": "Kas Keluar",
  "Expenses:Diskon": "Diskon",
};

export interface IncomeLine {
  account: string;
  label: string;
  amount: bigint;
}

export interface IncomeStatementResult {
  title: "Laba Rugi";
  period: { from: string | undefined; to: string | undefined };
  pendapatan: {
    lines: IncomeLine[];
    tunai: bigint;
    qris: bigint;
    online: bigint;
    total: bigint;
  };
  pengeluaran_bahan_baku: { lines: IncomeLine[]; total: bigint };
  laba_kotor: bigint;
  pengeluaran_operasional: { lines: IncomeLine[]; total: bigint };
  laba_bersih: bigint;
}

export function incomeStatement(
  book: Book,
  dateFrom?: string,
  dateTo?: string,
  cats?: Record<string, { name: string }>,
): IncomeStatementResult {
  const catMap = cats ?? {};

  function catName(account: string): string {
    const code = account.split(":").at(-1) ?? account;
    return catMap[code]?.name ?? NON_CATEGORY_LABELS[account] ?? code;
  }

  // Pendapatan
  const incomeLines: IncomeLine[] = [];
  for (const acct of book.accounts("Income:")) {
    const amt = -book.balance(acct, dateFrom, dateTo);
    incomeLines.push({ account: acct, label: acct.split(":").at(-1) ?? acct, amount: amt });
  }
  const totalPendapatan = -book.balancePrefix("Income:", dateFrom, dateTo);
  const tunai = -book.balance("Income:Sales:Tunai", dateFrom, dateTo);
  const qris = -book.balance("Income:Sales:QRIS", dateFrom, dateTo);
  const online = -book.balance("Income:Sales:Online", dateFrom, dateTo);

  // Pengeluaran Bahan Baku
  const bahanBakuLines: IncomeLine[] = [];
  for (const acct of book.accounts("Expenses:BahanBaku:")) {
    const amt = book.balance(acct, dateFrom, dateTo);
    if (amt !== 0n) {
      bahanBakuLines.push({ account: acct, label: catName(acct), amount: amt });
    }
  }
  const totalBahanBaku = book.balancePrefix("Expenses:BahanBaku:", dateFrom, dateTo);

  const labaKotor = totalPendapatan - totalBahanBaku;

  // Pengeluaran Operasional — EVERY expense account that is not bahan baku.
  //
  // This deliberately does NOT filter on the "Expenses:Operasional:" prefix. Doing so
  // silently dropped every expense account living outside the two known
  // prefixes — in kasir that is `Expenses:SelisihKas` (cash-drawer shortages at
  // tutup kas), so laba bersih was overstated by the full amount of every
  // shortage and nothing on the Laba Rugi screen revealed it. Caught 2026-07-28
  // when Perubahan Modal, Neraca and Arus Kas all independently reported
  // 5.275.000 while Laba Rugi claimed 5.300.000 on a book containing a 25.000
  // selisih. Taking "all Expenses: except bahan baku" also makes this agree with
  // getLedgerExpenseTotals in lib/ledger-queries.ts, which /admin/reports uses,
  // so the two screens can no longer disagree about laba bersih.
  const operasionalLines: IncomeLine[] = [];
  let totalOperasional = 0n;
  for (const acct of book.accounts("Expenses:")) {
    if (acct.startsWith("Expenses:BahanBaku:")) continue;
    const amt = book.balance(acct, dateFrom, dateTo);
    totalOperasional += amt;
    if (amt !== 0n) {
      operasionalLines.push({ account: acct, label: catName(acct), amount: amt });
    }
  }

  const labaBersih = labaKotor - totalOperasional;

  return {
    title: "Laba Rugi",
    period: { from: dateFrom, to: dateTo },
    pendapatan: {
      lines: incomeLines,
      tunai,
      qris,
      online,
      total: totalPendapatan,
    },
    pengeluaran_bahan_baku: { lines: bahanBakuLines, total: totalBahanBaku },
    laba_kotor: labaKotor,
    pengeluaran_operasional: { lines: operasionalLines, total: totalOperasional },
    laba_bersih: labaBersih,
  };
}
