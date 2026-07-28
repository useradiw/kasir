/**
 * Neraca (Balance Sheet) - snapshot as-of dateTo.
 * Mirrors Warung Books balance_sheet.py.
 *
 * Aset      = +S("Assets:") as-of
 * Kewajiban = -S("Liabilities:") as-of
 * Ekuitas   = -S("Equity:") as-of + NP_cum
 *   where NP_cum = -(S("Income:") + S("Expenses:")) as-of
 *
 * Assert: Aset == Kewajiban + Ekuitas
 */

import { Book } from "./book";
import { CASH_LABELS } from "./accounts";

export interface BalanceLine {
  account: string;
  label: string;
  amount: bigint;
}

export interface EkuitasLine {
  label: string;
  amount: bigint;
}

export interface BalanceSheetResult {
  title: "Neraca";
  as_of: string | undefined;
  aset: { lines: BalanceLine[]; total_kas: bigint; total: bigint };
  kewajiban: { total: bigint };
  ekuitas: {
    lines: EkuitasLine[];
    modal: bigint;
    opening: bigint;
    suspense: bigint;
    retained_earnings: bigint;
    total: bigint;
  };
  balanced: boolean;
}

export function balanceSheet(book: Book, dateTo?: string): BalanceSheetResult {
  // Aset
  const asetLines: BalanceLine[] = [];
  for (const acct of book.accounts("Assets:")) {
    const amt = book.balance(acct, undefined, dateTo);
    asetLines.push({ account: acct, label: CASH_LABELS[acct] ?? acct, amount: amt });
  }
  const totalAset = book.balancePrefix("Assets:", undefined, dateTo);
  const totalKas = book.balancePrefix("Assets:Cash:", undefined, dateTo);

  // Kewajiban
  const totalKewajiban = -book.balancePrefix("Liabilities:", undefined, dateTo);

  // Ekuitas
  const modal = -book.balance("Equity:Modal", undefined, dateTo);
  const opening = -book.balance("Equity:Opening", undefined, dateTo);
  const suspense = -book.balance("Equity:Suspense", undefined, dateTo);
  const prive = -book.balance("Equity:Prive", undefined, dateTo);
  const recordedEquity = -book.balancePrefix("Equity:", undefined, dateTo);

  const npCum = -(
    book.balancePrefix("Income:", undefined, dateTo) +
    book.balancePrefix("Expenses:", undefined, dateTo)
  );

  const totalEkuitas = recordedEquity + npCum;

  const ekuitasLines: EkuitasLine[] = [
    { label: "Modal", amount: modal },
    { label: "Saldo Awal", amount: opening },
  ];
  if (suspense !== 0n) {
    ekuitasLines.push({ label: "Suspense (belum terklasifikasi)", amount: suspense });
  }
  if (prive !== 0n) {
    // `prive` is already the equity-signed figure (negative — drawings REDUCE
    // equity) and is counted that way in recordedEquity/totalEkuitas. Emitting
    // `-prive` here flipped it positive, so the Ekuitas column rendered as
    // Modal + Saldo Awal + Prive + Saldo Laba and visibly failed to reach its
    // own Total — 9.275.000 shown against a correct total of 7.275.000. The
    // invariant that matters is sum(lines) === total; keep the sign as-is.
    ekuitasLines.push({ label: "Prive", amount: prive });
  }
  ekuitasLines.push({ label: "Saldo Laba", amount: npCum });

  return {
    title: "Neraca",
    as_of: dateTo,
    aset: { lines: asetLines, total_kas: totalKas, total: totalAset },
    kewajiban: { total: totalKewajiban },
    ekuitas: {
      lines: ekuitasLines,
      modal,
      opening,
      suspense,
      retained_earnings: npCum,
      total: totalEkuitas,
    },
    balanced: totalAset === totalKewajiban + totalEkuitas,
  };
}
