/**
 * Arus Kas (Cash Flow Statement) - period, direct method.
 * Mirrors Warung Books cash_flow.py.
 *
 * For each transaction touching Assets:Cash:* within the period:
 *   cash_delta = sum of its cash legs.
 *   Classify by the NON-cash counter-legs:
 *     Income:*        -> Operasi (in)
 *     Expenses:*      -> Operasi (out)
 *     Equity:Modal    -> Pendanaan (in)
 *     Equity:Opening  -> Pendanaan (opening)
 *     Equity:Prive    -> Pendanaan (out) — tokokencana's Prive screen posts here;
 *                        without this it fell through to Operasi and was flagged
 *                        as an unclassified account needing review.
 *     Assets:Fixed:*  -> Investasi (out)
 *     Liabilities:*   -> Pendanaan
 *     Assets:Cash:*   -> inter-cash transfer -> EXCLUDE (nets to zero)
 *     else            -> Operasi (default)
 *   share for a counter-leg p = -p.amount
 *
 * Assert: Operasi + Investasi + Pendanaan == ΔS("Assets:Cash:") over the period.
 */

import { Book } from "./book";

export interface ReviewItem {
  date: string;
  account: string;
  amount: bigint;
}

export interface CashFlowResult {
  title: "Arus Kas";
  period: { from: string | undefined; to: string | undefined };
  operasi: bigint;
  investasi: bigint;
  pendanaan: bigint;
  setoran_modal: bigint;
  setoran_saldo_awal: bigint;
  /** Prive (owner's drawings) taken during the period — negative = cash out. */
  pengambilan_prive: bigint;
  kenaikan_kas_bersih: bigint;
  delta_cash_check: bigint;
  kas_awal: bigint;
  kas_akhir: bigint;
  review: ReviewItem[];
}

type CfBucket = "operasi" | "investasi" | "pendanaan";

function classify(counterAccount: string): CfBucket {
  if (counterAccount.startsWith("Income:")) return "operasi";
  if (counterAccount.startsWith("Expenses:")) return "operasi";
  if (counterAccount.startsWith("Assets:Fixed")) return "investasi";
  if (counterAccount === "Equity:Modal") return "pendanaan";
  if (counterAccount === "Equity:Opening") return "pendanaan";
  if (counterAccount === "Equity:Prive") return "pendanaan";
  if (counterAccount.startsWith("Liabilities:")) return "pendanaan";
  return "operasi";
}

function dayBefore(date: string | undefined): string | undefined {
  if (date === undefined) return undefined;
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function cashFlow(
  book: Book,
  dateFrom?: string,
  dateTo?: string,
): CashFlowResult {
  let operasi = 0n;
  let investasi = 0n;
  let pendanaan = 0n;
  let setoranModal = 0n;
  let setoranSaldoAwal = 0n;
  let pengambilanPrive = 0n;
  const review: ReviewItem[] = [];

  for (const t of book.transactions) {
    // Access inRange via a workaround since it's private; reproduce the logic
    const date = t.date;
    if (dateFrom !== undefined && date < dateFrom) continue;
    if (dateTo !== undefined && date > dateTo) continue;

    const cashLegs = t.postings.filter((p) => p.account.startsWith("Assets:Cash:"));
    const counterLegs = t.postings.filter((p) => !p.account.startsWith("Assets:Cash:"));

    if (cashLegs.length === 0) continue;
    if (counterLegs.length === 0) continue; // pure inter-cash transfer

    for (const p of counterLegs) {
      const bucket = classify(p.account);
      const share = -p.amount; // credit -> +in ; debit expense -> -out

      if (bucket === "operasi") {
        operasi += share;
      } else if (bucket === "investasi") {
        investasi += share;
      } else {
        pendanaan += share;
        if (p.account === "Equity:Opening") setoranSaldoAwal += share;
        else if (p.account === "Equity:Modal") setoranModal += share;
        else if (p.account === "Equity:Prive") pengambilanPrive += share;
      }

      const isKnownCategory =
        p.account.startsWith("Income:") ||
        p.account.startsWith("Expenses:") ||
        p.account === "Equity:Modal" ||
        p.account === "Equity:Opening" ||
        p.account === "Equity:Prive" ||
        p.account.startsWith("Assets:Fixed") ||
        p.account.startsWith("Liabilities:");
      if (!isKnownCategory) {
        review.push({ date: t.date, account: p.account, amount: share });
      }
    }
  }

  const kenaikan = operasi + investasi + pendanaan;
  const deltaCash = book.balancePrefix("Assets:Cash:", dateFrom, dateTo);

  const before = dayBefore(dateFrom);
  const kasAwal = dateFrom !== undefined
    ? book.balancePrefix("Assets:Cash:", undefined, before)
    : 0n;
  const kasAkhir = book.balancePrefix("Assets:Cash:", undefined, dateTo);

  return {
    title: "Arus Kas",
    period: { from: dateFrom, to: dateTo },
    operasi,
    investasi,
    pendanaan,
    setoran_modal: setoranModal,
    setoran_saldo_awal: setoranSaldoAwal,
    pengambilan_prive: pengambilanPrive,
    kenaikan_kas_bersih: kenaikan,
    delta_cash_check: deltaCash,
    kas_awal: kasAwal,
    kas_akhir: kasAkhir,
    review,
  };
}
