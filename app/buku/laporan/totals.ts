/**
 * totals.ts — pure screen-level arithmetic for /buku/laporan.
 *
 * Every headline total this screen shows (pendapatan.total, hpp.total,
 * laba_bersih, kas_akhir, modal_akhir, neraca.aset.total, ...) already comes
 * straight out of getLaporanKeuangan (lib/laporan-keuangan.ts) and is
 * rendered as-is by the tab components — this file does NOT re-derive any of
 * those. Two ways of computing one number is exactly how three past
 * production bugs happened (laporan Gaji, Neraca Ekuitas, Laba Rugi — see
 * docs/redesign/plan-open-items.md section 1's "the one invariant").
 *
 * The one genuinely new figure this screen adds: mockup 2
 * (docs/redesign/screens-laporan.html) shows a single "Total Ekuitas +
 * Liabilitas" row where the engine only exposes kewajiban.total and
 * ekuitas.total separately. That combination is real screen-level summing,
 * so it lives here, tested, instead of inline in neraca-tab.tsx.
 */
export function totalEkuitasDanLiabilitas(neraca: {
  kewajiban: { total: number };
  ekuitas: { total: number };
}): number {
  return neraca.kewajiban.total + neraca.ekuitas.total;
}
