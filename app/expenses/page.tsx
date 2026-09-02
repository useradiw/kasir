import { redirect } from "next/navigation";

/**
 * /expenses retired 2026-09-02 — the cashier-facing Catat Pengeluaran form is
 * now /buku/belanja, which renders the same add-only form with the same
 * requireAuth() gate (docs/redesign/plan-open-items.md section 1, step 5).
 *
 * Kept as a redirect rather than deleted: cashiers have this URL on their phone
 * home screens, and the petunjuk has taught it for months.
 */
export default function ExpensesPage() {
  redirect("/buku/belanja");
}
