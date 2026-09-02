/**
 * totals.ts — the single source of truth for every figure and filter
 * decision the jurnal screen renders. Both the list and the detail read
 * these helpers instead of computing inline, so the money invariant — a
 * column of figures adds up to the total shown against it — holds by
 * construction rather than by copies staying in sync.
 *
 * Plain module: no "use server" (pure, synchronous logic) and no "use
 * client" (jurnal-client.tsx imports it as a client component, but the
 * functions themselves have no framework dependency).
 */

/** Rp shown per row / in the hero: the sum of the POSITIVE (debit) legs.
 *  For a balanced entry this equals the entry's size on either side. */
export function entryAmount(lines: { amount: number }[]): number {
  return lines.reduce((sum, l) => (l.amount > 0 ? sum + l.amount : sum), 0);
}

/** Signed sum of every leg — the "Selisih Dr - Cr" figure. 0 when balanced. */
export function entryImbalance(lines: { amount: number }[]): number {
  return lines.reduce((sum, l) => sum + l.amount, 0);
}

/** An entry balances when its lines sum to exactly 0 (same rule the old
 *  admin/keuangan/page.tsx used). */
export function isBalanced(lines: { amount: number }[]): boolean {
  return entryImbalance(lines) === 0;
}

export type JurnalFilter = "semua" | "penjualan" | "belanja" | "kas" | "void";

export const JURNAL_FILTERS: JurnalFilter[] = ["semua", "penjualan", "belanja", "kas", "void"];

export const FILTER_LABEL: Record<JurnalFilter, string> = {
  semua: "Semua",
  penjualan: "Penjualan",
  belanja: "Belanja",
  kas: "Kas",
  void: "VOID",
};

// sourceType values used verbatim across the codebase (lib/ledger-queries.ts,
// lib/accounting/catatRepository.ts's CatatSourceType, salesPostingRepository.ts).
const KAS_SOURCE_TYPES = new Set(["transfer", "modal", "prive", "saldo-awal"]);

/**
 * Whether one jurnal entry belongs to a filter chip. Semua/Penjualan/
 * Belanja/Kas key off sourceType; VOID keys off `state`, not sourceType — a
 * voided pengeluaran still matches "Belanja" too, since the chips are
 * independent predicates, not a partition.
 */
export function matchesJurnalFilter(
  filter: JurnalFilter,
  entry: { sourceType: string | null; state: string },
): boolean {
  switch (filter) {
    case "semua":
      return true;
    case "penjualan":
      return entry.sourceType === "shift-close";
    case "belanja":
      return entry.sourceType === "pengeluaran";
    case "kas":
      return entry.sourceType !== null && KAS_SOURCE_TYPES.has(entry.sourceType);
    case "void":
      return entry.state === "VOID";
  }
}

/** sourceType -> the same human labels the old admin/keuangan/page.tsx used
 *  (its SOURCE_LABEL map), verbatim. "shift-close" and a null sourceType
 *  (manual "Penyesuaian" entries) have no entry here on purpose — the caller
 *  falls back to the raw sourceType or omits the label. */
export const SOURCE_LABEL: Record<string, string> = {
  pengeluaran: "Pengeluaran",
  transfer: "Transfer",
  modal: "Modal",
  prive: "Prive",
  "saldo-awal": "Saldo Awal",
};

/** The sourceTypes that have a void action wired (voidPengeluaran / voidCatat).
 *  shift-close, settlement and a null sourceType have no generic void action —
 *  deliberately out of scope, see jurnal-client.tsx. */
export const VOIDABLE_SOURCE_TYPES = new Set(["pengeluaran", "transfer", "modal", "prive", "saldo-awal"]);
