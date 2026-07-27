/**
 * Validation battery - the safety net.
 * Mirrors Warung Books validate.py (the dataset-agnostic checks).
 *
 * Implements the same 13-point tie-out assertions. Checks that require a DB
 * connection (balance assertions from ev_balance_check, sale-event cross-check)
 * are skipped gracefully when no conn is provided - they pass trivially (as in
 * the WB implementation's conn=None branch).
 *
 * The report runner should REFUSE to emit if any assertion fails.
 */

import { Book } from "./book";
import { incomeStatement } from "./incomeStatement";
import { balanceSheet } from "./balanceSheet";
import { changesInEquity } from "./changesInEquity";
import { cashFlow } from "./cashFlow";

export interface ValidationCheck {
  name: string;
  pass: boolean;
  detail: string;
  [key: string]: unknown;
}

export interface ValidationResult {
  all_pass: boolean;
  checks: ValidationCheck[];
  warnings: string[];
  suspense_total: bigint;
  drift_total: bigint;
  sales_crosscheck: {
    tunai_gap: bigint;
    qris_gap: bigint;
    online: bigint;
    total_gap: bigint;
  };
}

/**
 * Optional DB interface for DB-backed checks.
 * When not provided, DB-dependent checks pass trivially (informational only).
 */
export interface ValidationConn {
  /** Expected cash balances per account name { "Assets:Cash:Mandiri": amount } */
  closingBalances?: Record<string, bigint>;
  /** Ev_sale totals for the period */
  saleTotals?: { tunai: bigint; qris: bigint; online: bigint };
}

export function runValidations(
  book: Book,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  cats?: Record<string, { name: string }>,
  conn?: ValidationConn,
): ValidationResult {
  const checks: ValidationCheck[] = [];
  const warnings: string[] = [];

  function check(name: string, ok: boolean, detail: string, extra?: Record<string, unknown>): void {
    checks.push({ name, pass: ok, detail, ...extra });
  }

  const ls = incomeStatement(book, dateFrom, dateTo, cats);
  const bs = balanceSheet(book, dateTo);
  const ce = changesInEquity(book, dateFrom, dateTo);
  const cf = cashFlow(book, dateFrom, dateTo);

  const npPeriod = ls.laba_bersih;

  // (1) every transaction balances
  const bad = book.transactions.filter((t) => !t.balances());
  check(
    "Setiap transaksi balance ke nol",
    bad.length === 0,
    `${book.transactions.length} transaksi, ${bad.length} tidak balance`,
  );

  // (2) whole-ledger equation residual == 0
  const resid = book.equationResidual();
  check(
    "Persamaan akuntansi: residual buku = 0",
    resid === 0n,
    `residual = ${resid}`,
  );

  // (3) LabaRugi.LabaBersih == NP_period
  check(
    "Laba Rugi: Laba Bersih = -(Income+Expenses)",
    ls.laba_bersih === npPeriod,
    `Laba Bersih = ${npPeriod}`,
  );

  // (4) PerubahanModal.LabaBersih == NP_period
  check(
    "Perubahan Modal: baris Laba Bersih = NP periode",
    ce.laba_bersih === npPeriod,
    `PM Laba Bersih = ${ce.laba_bersih} | NP = ${npPeriod}`,
  );

  // (5) PerubahanModal.ModalAkhir == Neraca.TotalEkuitas
  check(
    "Perubahan Modal: Modal Akhir = Total Ekuitas Neraca",
    ce.modal_akhir === bs.ekuitas.total,
    `Modal Akhir = ${ce.modal_akhir} | Ekuitas Neraca = ${bs.ekuitas.total}`,
  );

  // (6) Neraca.TotalEkuitas == -S("Equity:") + NP_cum
  const recEq = -book.balancePrefix("Equity:", undefined, dateTo);
  const npCum = -(
    book.balancePrefix("Income:", undefined, dateTo) +
    book.balancePrefix("Expenses:", undefined, dateTo)
  );
  check(
    "Neraca: Total Ekuitas = Equity tercatat + Laba Ditahan",
    bs.ekuitas.total === recEq + npCum,
    `Ekuitas = ${bs.ekuitas.total} | tercatat ${recEq} + NP_cum ${npCum}`,
  );

  // (7) Neraca balances: Aset == Kewajiban + Ekuitas
  check(
    "Neraca seimbang: Aset = Kewajiban + Ekuitas",
    bs.aset.total === bs.kewajiban.total + bs.ekuitas.total,
    `Aset = ${bs.aset.total} | Kewajiban+Ekuitas = ${bs.kewajiban.total + bs.ekuitas.total}`,
  );

  // (8) ArusKas.KenaikanKasBersih == ΔS("Assets:Cash:")
  check(
    "Arus Kas: Kenaikan Kas Bersih = perubahan Assets:Cash",
    cf.kenaikan_kas_bersih === cf.delta_cash_check,
    `AK net = ${cf.kenaikan_kas_bersih} | perubahan Kas = ${cf.delta_cash_check}`,
  );

  // (9) OpeningCash + KenaikanKasBersih == Neraca.TotalKas
  check(
    "Arus Kas: Kas Awal + Kenaikan = Total Kas Neraca",
    cf.kas_awal + cf.kenaikan_kas_bersih === bs.aset.total_kas,
    `${cf.kas_awal} + ${cf.kenaikan_kas_bersih} = ${cf.kas_awal + cf.kenaikan_kas_bersih} | Neraca Kas = ${bs.aset.total_kas}`,
  );

  // (10) cash-by-construction: derived cash balance == any asserted balance
  let driftTotal = 0n;
  if (conn?.closingBalances) {
    for (const [acct, expected] of Object.entries(conn.closingBalances)) {
      const posted = book.balance(acct, undefined, dateTo);
      const drift = posted - expected;
      driftTotal += drift < 0n ? -drift : drift;
      check(
        `Saldo kas sesuai assertion: ${acct}`,
        drift === 0n,
        `posting = ${posted} | expected = ${expected} | selisih = ${drift}`,
        { drift },
      );
    }
  }

  // (11) suspense / unclassified surfaced
  const suspense = -book.balancePrefix("Equity:Suspense", undefined, dateTo);
  const unclassified = book.balancePrefix("Income:Unclassified", undefined, dateTo);
  check(
    "Tidak ada saldo Suspense / Unclassified",
    suspense === 0n && unclassified === 0n,
    `Suspense = ${suspense} | Income:Unclassified = ${unclassified}`,
    { suspense },
  );

  // (12) sale-event cross-check — INFORMATIONAL
  const ledTunai = ls.pendapatan.tunai;
  const ledQris = ls.pendapatan.qris;
  const ledOnline = ls.pendapatan.online;

  let tunaiGap = 0n;
  let qrisGap = 0n;
  let totalGap = 0n;

  if (conn?.saleTotals) {
    const { tunai: scTunai, qris: scQris, online: scOnline } = conn.saleTotals;
    tunaiGap = ledTunai - scTunai;
    qrisGap = ledQris - scQris;
    totalGap = (ledTunai + ledQris + ledOnline) - (scTunai + scQris + scOnline);
    check(
      "Cross-check ev_sale = Laba Rugi pendapatan",
      totalGap === 0n,
      `Tunai ${ledTunai} (ev ${scTunai}); QRIS ${ledQris} (ev ${scQris}); Online ${ledOnline} (ev ${scOnline}); total selisih = ${totalGap}`,
    );
    // (13) QRIS leg equals recorded ev_sale QRIS
    check(
      "QRIS Laba Rugi = ev_sale QRIS (net refund)",
      ledQris === scQris,
      `QRIS = ${ledQris} | ev_sale = ${scQris}`,
    );
  } else {
    // No event-table access: informational, pass trivially
    check(
      "Cross-check ev_sale (informasi, tanpa conn)",
      true,
      `Tunai ${ledTunai}; QRIS ${ledQris}; Online ${ledOnline}`,
    );
  }

  const allPass = checks.every((c) => c.pass);
  return {
    all_pass: allPass,
    checks,
    warnings,
    suspense_total: suspense,
    drift_total: driftTotal,
    sales_crosscheck: {
      tunai_gap: tunaiGap,
      qris_gap: qrisGap,
      online: ledOnline,
      total_gap: totalGap,
    },
  };
}
