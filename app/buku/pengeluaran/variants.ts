/**
 * The five pengeluaran variants, in a module with NO "use client".
 *
 * These constants must live outside entry-form.tsx. A Server Component that
 * imports a non-function export from a client module receives a client
 * reference proxy rather than the value, so `JENIS_VALUES.includes(...)` in
 * page.tsx threw "includes is not a function" at request time — the page
 * crashed for every visitor while the build stayed green. Keep plain data
 * here and let both the server page and the client form import it.
 */

export type Jenis = "belanja" | "transfer" | "modal" | "prive" | "saldo-awal";

export const JENIS_VALUES: Jenis[] = ["belanja", "transfer", "modal", "prive", "saldo-awal"];

/** Title shown in the topbar h1 (SPEC #13) — the single source both
 *  app/buku/pengeluaran/page.tsx and app/buku/belanja/page.tsx read from. */
export const VARIANT_TITLE: Record<Jenis, string> = {
  belanja: "Catat Pengeluaran",
  transfer: "Transfer Kas",
  modal: "Setoran Modal",
  prive: "Prive (Ambil Pribadi)",
  "saldo-awal": "Saldo Awal",
};

/** Short label for the segmented pill row. */
export const PILL_LABEL: Record<Jenis, string> = {
  belanja: "Belanja",
  transfer: "Transfer",
  modal: "Modal",
  prive: "Prive",
  "saldo-awal": "Saldo Awal",
};
