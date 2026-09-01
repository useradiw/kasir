import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/admin-auth";
import { listCategories } from "@/app/actions/admin/queries";
import { KategoriClient } from "./kategori-client";

export const dynamic = "force-dynamic";

/**
 * /buku/kategori — expense categories (SPEC #18), replaces
 * app/admin/keuangan/kategori. Reuses listCategories/createCategory/
 * updateCategory/deleteCategory/seedDefaultCategories unchanged
 * (docs/redesign/plan-open-items.md section 1, build order 3). Unlike the old
 * page, the seed button is always shown, not only when the list is empty.
 */
export default async function BukuKategoriPage() {
  const staff = await requireOwner();
  const categories = await listCategories();

  return (
    <AppShell role={staff.role}>
      <div className="px-4 pb-1 pt-5">
        <Link href="/buku" className="text-[12.5px] font-bold text-muted-foreground">
          ← Buku
        </Link>
        <h1 className="font-display mt-2 text-[17px] font-bold">Kategori</h1>
        <p className="text-[11.5px] font-semibold text-muted-foreground">Kategori pengeluaran</p>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        <KategoriClient categories={categories} />
      </div>
    </AppShell>
  );
}
