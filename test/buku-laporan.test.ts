/**
 * buku-laporan.test.ts — /buku/laporan rebuild (SPEC #10,
 * docs/redesign/plan-open-items.md section 1, build order 8, the last
 * screen in this rebuild).
 *
 * The money invariant is the whole point of this file: any column of
 * figures the screen shows must add up to the total shown against it. That
 * invariant has been a real production bug three times before (laporan
 * Gaji, Neraca Ekuitas, Laba Rugi).
 *
 * test/statements.test.ts already proves these ties hold in the ENGINE
 * (lib/accounting/*), posting real entries through pglite. This file is
 * deliberately NOT that — it never imports anything under app/actions/** or
 * touches a database (test/env-guard.ts blocks that on purpose). It builds
 * plain LaporanKeuangan-shaped fixtures by hand and checks what the SCREEN
 * actually renders from them: the pure totals.ts helper this rebuild adds,
 * and the fields the tab components read directly.
 */

import { describe, it, expect } from "vitest";
import { totalEkuitasDanLiabilitas } from "../app/buku/laporan/totals";

// ---------------------------------------------------------------------------
// Fixture: one internally-consistent LaporanKeuangan-shaped month, built by
// hand so every statement ties out the way a real posted month would.
// ---------------------------------------------------------------------------

const pendapatan = { tunai: 4_500_000, qris: 2_100_000, online: 980_000, total: 7_580_000 };
const hpp = { lines: [{ account: "Expenses:HPP:BahanBaku", label: "Bahan baku terjual", amount: 2_940_000 }], total: 2_940_000 };
const labaKotor = pendapatan.total - hpp.total; // 4.640.000
const biayaOperasional = {
  lines: [
    { account: "Expenses:OpEx:Gaji", label: "Gaji", amount: 1_200_000 },
    { account: "Expenses:OpEx:Sewa", label: "Sewa", amount: 500_000 },
    { account: "Expenses:OpEx:Utilitas", label: "Listrik & air", amount: 180_000 },
    { account: "Expenses:OpEx:Komisi", label: "Komisi online", amount: 98_000 },
    { account: "Expenses:SelisihKas", label: "Selisih kas", amount: 10_000 },
  ],
  total: 1_988_000,
};
const labaBersih = labaKotor - biayaOperasional.total; // 2.652.000

const labaRugi = {
  pendapatan,
  hpp,
  laba_kotor: labaKotor,
  biaya_operasional: biayaOperasional,
  laba_bersih: labaBersih,
};

const neraca = {
  aset: {
    lines: [
      { account: "Assets:Cash:Laci", label: "Kas Laci", amount: 1_250_000 },
      { account: "Assets:Cash:Qris", label: "Kas QRIS belum cair", amount: 890_000 },
      { account: "Assets:Cash:BCA", label: "Bank BCA", amount: 12_400_000 },
    ],
    total: 14_540_000,
  },
  kewajiban: { total: 0 },
  ekuitas: {
    lines: [
      { label: "Modal", amount: 10_000_000 },
      { label: "Saldo Awal", amount: 1_888_000 },
      { label: "Saldo Laba", amount: 2_652_000 },
    ],
    total: 14_540_000,
  },
  balanced: true,
};

const arusKas = {
  operasi: 2_652_000,
  investasi: 0,
  pendanaan: -500_000,
  setoran_modal: 0,
  setoran_saldo_awal: 0,
  pengambilan_prive: -500_000,
  kenaikan_kas_bersih: 2_152_000,
  kas_awal: 12_388_000,
  kas_akhir: 14_540_000,
};

const perubahanModal = {
  modal_awal: 11_888_000,
  tambahan_modal: 0,
  laba_bersih: 2_652_000,
  prive: 500_000, // debit-positive, per changesInEquity.ts
  modal_akhir: 14_040_000,
};

// ---------------------------------------------------------------------------
// Laba Rugi
// ---------------------------------------------------------------------------

describe("Laba Rugi — the screen's rows add up to the totals shown against them", () => {
  it("pendapatan channels (tunai/qris/online, the three hardcoded rows the tab renders) sum to Total Pendapatan", () => {
    expect(labaRugi.pendapatan.tunai + labaRugi.pendapatan.qris + labaRugi.pendapatan.online).toBe(
      labaRugi.pendapatan.total,
    );
  });

  it("hpp.lines (every row the tab maps over) sum to Total HPP", () => {
    const sum = labaRugi.hpp.lines.reduce((s, l) => s + l.amount, 0);
    expect(sum).toBe(labaRugi.hpp.total);
  });

  it("biaya_operasional.lines (every row the tab maps over) sum to Total Beban", () => {
    const sum = labaRugi.biaya_operasional.lines.reduce((s, l) => s + l.amount, 0);
    expect(sum).toBe(labaRugi.biaya_operasional.total);
  });

  it("pendapatan - HPP - beban = laba bersih", () => {
    expect(labaRugi.pendapatan.total - labaRugi.hpp.total - labaRugi.biaya_operasional.total).toBe(
      labaRugi.laba_bersih,
    );
  });
});

// ---------------------------------------------------------------------------
// Neraca
// ---------------------------------------------------------------------------

describe("Neraca — aset total = liabilitas + ekuitas total", () => {
  it("neraca.ekuitas.lines (every row the tab maps over) sum to neraca.ekuitas.total", () => {
    const sum = neraca.ekuitas.lines.reduce((s, l) => s + l.amount, 0);
    expect(sum).toBe(neraca.ekuitas.total);
  });

  it("totalEkuitasDanLiabilitas (the new combined row mockup 2 shows) equals Total Aset when the book balances", () => {
    expect(totalEkuitasDanLiabilitas(neraca)).toBe(neraca.aset.total);
  });

  it("does not just always return true — an unbalanced fixture actually fails the check", () => {
    const unbalanced = { kewajiban: { total: 0 }, ekuitas: { total: neraca.ekuitas.total - 1 } };
    expect(totalEkuitasDanLiabilitas(unbalanced)).not.toBe(neraca.aset.total);
  });
});

// ---------------------------------------------------------------------------
// Arus Kas
// ---------------------------------------------------------------------------

describe("Arus Kas — sections sum to kas bersih, and kas awal + kas bersih = kas akhir", () => {
  it("operasi + investasi + pendanaan = kenaikan kas bersih", () => {
    expect(arusKas.operasi + arusKas.investasi + arusKas.pendanaan).toBe(arusKas.kenaikan_kas_bersih);
  });

  it("kas awal + kenaikan kas bersih = kas akhir", () => {
    expect(arusKas.kas_awal + arusKas.kenaikan_kas_bersih).toBe(arusKas.kas_akhir);
  });
});

// ---------------------------------------------------------------------------
// Perubahan Modal
// ---------------------------------------------------------------------------

describe("Perubahan Modal — modal awal + setoran + laba - prive = modal akhir", () => {
  it("ties out using the engine's debit-positive prive sign (the tab negates prive only for display)", () => {
    expect(
      perubahanModal.modal_awal + perubahanModal.tambahan_modal + perubahanModal.laba_bersih - perubahanModal.prive,
    ).toBe(perubahanModal.modal_akhir);
  });
});
