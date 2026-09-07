import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { requireAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ExpenseRepository } from "@/lib/accounting/expenseRepository";
import { CashAccountRepository } from "@/lib/accounting/cashAccountRepository";
import { recordPengeluaranAsStaff } from "@/app/actions/admin/keuangan";
import { EntryForm } from "../pengeluaran/entry-form";

export const dynamic = "force-dynamic";

/**
 * /buku/belanja — the /buku rebuild of app/expenses (the cashier-facing
 * "Catat Pengeluaran" form): add-only, no list and no Void
 * (docs/redesign/plan-open-items.md section 1, build order 5).
 *
 * Gated with requireAuth(), NOT requireCan("buku.read") — the only page under /buku
 * that is. Adi authorised this explicitly on 2026-09-01, it mirrors the deliberate
 * requireAuth() gate on recordPengeluaranAsStaff (see the comment above that
 * action in app/actions/admin/keuangan.ts), and it must not be "fixed" to
 * a capability gate. test/buku-pengeluaran.test.ts guards this.
 *
 * It therefore reads the two lists through the lib repositories DIRECTLY rather
 * than through app/actions/admin/queries, whose exports are thin requireCan("buku.read")
 * wrappers built for client callers. Routing this page through those wrappers
 * redirected every cashier to /beranda and made the page unreachable for the
 * only role it exists for (found in UAT 2026-09-03). This is a server
 * component and requireAuth() above is its gate, so calling lib is the correct
 * layer. Do NOT reintroduce the queries import here.
 */
export default async function BukuBelanjaPage() {
  const staff = await requireAuth();
  const [categories, cashAccounts] = await Promise.all([
    new ExpenseRepository(prisma).listCategories(),
    new CashAccountRepository(prisma).list(),
  ]);

  return (
    <AppShell role={staff.role}>
      <div className="px-4 pb-1 pt-5">
        {/* No "← Buku" link: a cashier cannot open /buku, so it links back to
            /beranda instead, unlike every other page in this folder. */}
        <Link href="/beranda" className="cursor-pointer text-[12.5px] font-bold text-muted-foreground">
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
