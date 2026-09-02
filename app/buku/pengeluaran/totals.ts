/**
 * totals.ts — the single source of truth for the two figures the pengeluaran
 * screen shows: each line's amount (belanja's multi-line item block) and the
 * sum shown against a list of rows (the form's total bar, the list's footer
 * total). Both call sites import these instead of computing inline, so the
 * money invariant — a column of figures adds up to the total shown against it
 * — holds by construction rather than by two copies staying in sync.
 *
 * Plain module: no "use server" (it is pure, synchronous logic, not a server
 * action) and no "use client" (both a server page, via entry-list's footer
 * math done at render time in a client component, and a client form import
 * it — keeping the file directive-free lets either import it).
 */

/** Rp for one belanja line: qty x harga satuan, rounded to the nearest whole
 *  Rupiah. Non-finite/NaN inputs (an emptied field, a stray "-") count as 0
 *  rather than poisoning the total with NaN. */
export function computeLineJumlah(qty: number, hargaSatuan: number): number {
  if (!Number.isFinite(qty) || !Number.isFinite(hargaSatuan)) return 0;
  return Math.round(qty * hargaSatuan);
}

/** Sum of `jumlah` across a list of rows — the total bar / footer total. */
export function sumJumlah(rows: { jumlah: number }[]): number {
  return rows.reduce((sum, r) => sum + r.jumlah, 0);
}
