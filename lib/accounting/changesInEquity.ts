/**
 * Perubahan Modal (Statement of Changes in Equity) - period report.
 * Mirrors Warung Books changes_in_equity.py.
 *
 *   Modal Awal    = recorded equity before period + retained earnings before period
 *                   + Equity:Opening posted at/within period
 *                   + Equity:Suspense in period
 *   Tambahan Modal = +S("Equity:Modal") during period
 *   Laba Bersih   = -(S("Income:") + S("Expenses:")) over period
 *   Prive         = +S("Equity:Prive") during period (debit-positive)
 *   Modal Akhir   = Modal Awal + Tambahan Modal + Laba Bersih - Prive
 *
 * Tie-out: Modal Akhir == Neraca.TotalEkuitas (as-of dateTo)
 */

import { Book } from "./book";

export interface ChangesInEquityResult {
  title: "Perubahan Modal";
  period: { from: string | undefined; to: string | undefined };
  modal_awal: bigint;
  tambahan_modal: bigint;
  laba_bersih: bigint;
  prive: bigint;
  modal_akhir: bigint;
}

function dayBefore(date: string | undefined): string | undefined {
  if (date === undefined) return undefined;
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function changesInEquity(
  book: Book,
  dateFrom?: string,
  dateTo?: string,
): ChangesInEquityResult {
  const before = dayBefore(dateFrom);

  // Recorded equity strictly before the period
  const recBefore = before !== undefined
    ? -book.balancePrefix("Equity:", undefined, before)
    : 0n;

  // Retained earnings strictly before the period
  const npBefore = before !== undefined
    ? -(
        book.balancePrefix("Income:", undefined, before) +
        book.balancePrefix("Expenses:", undefined, before)
      )
    : 0n;

  // Carried-in opening balance + suspense within the period
  const openingInPeriod = -book.balance("Equity:Opening", dateFrom, dateTo);
  const suspenseInPeriod = -book.balance("Equity:Suspense", dateFrom, dateTo);

  const modalAwal = recBefore + npBefore + openingInPeriod + suspenseInPeriod;

  // Capital injected during the period
  const tambahanModal = -book.balance("Equity:Modal", dateFrom, dateTo);

  // Net profit this period
  const labaBersih = -(
    book.balancePrefix("Income:", dateFrom, dateTo) +
    book.balancePrefix("Expenses:", dateFrom, dateTo)
  );

  // Owner withdrawals this period (debit-positive)
  const prive = book.balance("Equity:Prive", dateFrom, dateTo);

  const modalAkhir = modalAwal + tambahanModal + labaBersih - prive;

  return {
    title: "Perubahan Modal",
    period: { from: dateFrom, to: dateTo },
    modal_awal: modalAwal,
    tambahan_modal: tambahanModal,
    laba_bersih: labaBersih,
    prive,
    modal_akhir: modalAkhir,
  };
}
