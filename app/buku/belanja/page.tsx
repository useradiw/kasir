import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { requireAuth } from "@/lib/admin-auth";
import { listCategories, listCashAccounts } from "@/app/actions/admin/queries";
import { recordPengeluaranAsStaff } from "@/app/actions/admin/keuangan";
import { EntryForm } from "../pengeluaran/entry-form";

export const dynamic = "force-dynamic";

/**
 * /buku/belanja — the /buku rebuild of app/expenses (the cashier-facing
 * "Catat Pengeluaran" form): add-only, no list and no Void
 * (docs/redesign/plan-open-items.md section 1, build order 5).
 *
 * Gated with requireAuth(), NOT requireOwner() — the only page under /buku
 * that is. Adi authorised this explicitly on 2026-09-01, it mirrors the deliberate
 * requireAuth() gate on recordPengeluaranAsStaff (see the comment above that
 * action in app/actions/admin/keuangan.ts), and it must not be "fixed" to
 * requireOwner(). test/buku-pengeluaran.test.ts guards this.
 */
export default async function BukuBelanjaPage() {
  const staff = await requireAuth();
  const [categories, cashAccounts] = await Promise.all([
    listCategories(),
    listCashAccounts(),
  ]);

  return (
    <AppShell role={staff.role}>
      <div className="px-4 pb-1 pt-5">
        {/* No "← Buku" link: a cashier cannot open /buku, so it links back to
            /beranda instead, unlike every other page in this folder. */}
        <Link href="/beranda" className="text-[12.5px] font-bold text-muted-foreground">
          ← Beranda
        </Link>
        <h1 className="font-display mt-2 text-[17px] font-bold">Catat Pengeluaran</h1>
        <p className="text-[11.5px] font-semibold text-muted-foreground">Tambah pengeluaran kas</p>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        <EntryForm
          jenis="belanja"
          cashAccounts={cashAccounts.map((a) => ({ name: a.name, label: a.label }))}
          categories={categories.filter((c) => c.active).map((c) => ({ code: c.code, name: c.name, bucket: c.bucket }))}
          action={recordPengeluaranAsStaff}
        />
      </div>
    </AppShell>
  );
}
