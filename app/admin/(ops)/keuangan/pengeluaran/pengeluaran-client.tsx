"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAdminAction } from "@/hooks/use-admin-action";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { formatRupiah } from "@/lib/format";
import { PengeluaranForm } from "../_components/pengeluaran-form";
import { recordPengeluaran, voidPengeluaran } from "@/app/actions/admin/keuangan";

type CashAccount = { name: string; label: string };
type Category = { code: string; name: string; bucket: "HPP" | "OPEX" };
type Row = {
  id: string;
  date: string;
  item: string;
  qty: number | string;
  jumlah: number;
  akun: string;
  kategoriCode: string;
  kategoriNama: string | null;
};

export function PengeluaranClient({
  cashAccounts,
  categories,
  rows,
  month,
}: {
  cashAccounts: CashAccount[];
  categories: Category[];
  rows: Row[];
  month: string;
}) {
  const router = useRouter();
  const { isPending, run } = useAdminAction();
  const confirm = useConfirm();

  async function remove(id: string) {
    if (!(await confirm({ title: "Hapus (void) pengeluaran ini?", destructive: true, confirmLabel: "Hapus" }))) return;
    run(async () => {
      await voidPengeluaran(id);
      router.refresh();
    }, { successMessage: "Pengeluaran dihapus" });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <PengeluaranForm cashAccounts={cashAccounts} categories={categories} action={recordPengeluaran} />

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="border-b px-4 py-2 text-xs text-muted-foreground">
          {rows.length} pengeluaran &middot; {month}
        </div>
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Belum ada pengeluaran bulan ini</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Item</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3 text-right">Jumlah</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                {rows.map((r) => (
                  <tr key={r.id} className="text-sm">
                    <td className="p-3 whitespace-nowrap">{r.date}</td>
                    <td className="p-3 font-medium">{r.item}</td>
                    <td className="p-3">{r.kategoriNama ?? r.kategoriCode}</td>
                    <td className="p-3 text-right tabular-nums">{formatRupiah(r.jumlah)}</td>
                    <td className="p-3 text-right">
                      <Button size="xs" variant="destructive" disabled={isPending} onClick={() => remove(r.id)}>
                        Void
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
