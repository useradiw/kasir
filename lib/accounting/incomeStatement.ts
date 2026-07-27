/**
 * Laba Rugi (Income Statement) - period report.
 * Mirrors Warung Books income_statement.py.
 *
 * Pendapatan (Income) = -S("Income:")            [credits are negative]
 * HPP                  = +S("Expenses:HPP:")
 * Laba Kotor          = Pendapatan - HPP
 * Biaya Operasional   = +S("Expenses:OpEx:")
 * Laba Bersih         = Laba Kotor - Biaya Operasional
 */

import { Book } from "./book";

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
  hpp: { lines: IncomeLine[]; total: bigint };
  laba_kotor: bigint;
  biaya_operasional: { lines: IncomeLine[]; total: bigint };
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
    return catMap[code]?.name ?? code;
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

  // HPP
  const hppLines: IncomeLine[] = [];
  for (const acct of book.accounts("Expenses:HPP:")) {
    const amt = book.balance(acct, dateFrom, dateTo);
    if (amt !== 0n) {
      hppLines.push({ account: acct, label: catName(acct), amount: amt });
    }
  }
  const totalHpp = book.balancePrefix("Expenses:HPP:", dateFrom, dateTo);

  const labaKotor = totalPendapatan - totalHpp;

  // Biaya Operasional
  const opexLines: IncomeLine[] = [];
  for (const acct of book.accounts("Expenses:OpEx:")) {
    const amt = book.balance(acct, dateFrom, dateTo);
    if (amt !== 0n) {
      opexLines.push({ account: acct, label: catName(acct), amount: amt });
    }
  }
  const totalOpex = book.balancePrefix("Expenses:OpEx:", dateFrom, dateTo);

  const labaBersih = labaKotor - totalOpex;

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
    hpp: { lines: hppLines, total: totalHpp },
    laba_kotor: labaKotor,
    biaya_operasional: { lines: opexLines, total: totalOpex },
    laba_bersih: labaBersih,
  };
}
