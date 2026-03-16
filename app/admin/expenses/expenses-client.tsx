"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBanner, TableEmptyRow } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { addExpense, deleteExpense } from "@/app/actions/admin/expenses";

type Expense = { id: string; amount: number; note: string | null; recordedAt: string; createdAt: string };

export default function ExpensesClient({
  expenses,
  totalAmount,
  filters,
}: {
  expenses: Expense[];
  totalAmount: number;
  filters: { from: string; to: string };
}) {
  const router = useRouter();
  const { isPending, run, error } = useAdminAction();
  const [localFilters, setLocalFilters] = useState(filters);

  function applyFilters() {
    const params = new URLSearchParams();
    if (localFilters.from) params.set("from", localFilters.from);
    if (localFilters.to) params.set("to", localFilters.to);
    router.push(`/admin/expenses?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pengeluaran</h1>

      <ErrorBanner error={error} />

      {/* Add form */}
      <Card>
        <CardHeader><CardTitle>Tambah Pengeluaran</CardTitle></CardHeader>
        <CardContent>
          <form
            action={(fd) => run(() => addExpense(fd))}
            className="flex flex-wrap gap-3 items-end"
          >
            <div className="grid gap-1">
              <Label>Jumlah (Rp)</Label>
              <Input name="amount" type="number" min={1} required placeholder="Jumlah" className="w-40" />
            </div>
            <div className="grid gap-1">
              <Label>Keterangan</Label>
              <Input name="note" placeholder="Keterangan (opsional)" className="w-60" />
            </div>
            <div className="grid gap-1">
              <Label>Tanggal</Label>
              <Input name="recordedAt" type="datetime-local" className="w-44" />
            </div>
            <Button type="submit" size="sm" disabled={isPending}>Tambah</Button>
          </form>
        </CardContent>
      </Card>

      {/* Filter */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="grid gap-1">
              <Label>Dari</Label>
              <Input type="date" value={localFilters.from} onChange={(e) => setLocalFilters((f) => ({ ...f, from: e.target.value }))} className="w-36" />
            </div>
            <div className="grid gap-1">
              <Label>Sampai</Label>
              <Input type="date" value={localFilters.to} onChange={(e) => setLocalFilters((f) => ({ ...f, to: e.target.value }))} className="w-36" />
            </div>
            <Button onClick={applyFilters} size="sm">Filter</Button>
            <Button variant="ghost" size="sm" onClick={() => { setLocalFilters({ from: "", to: "" }); router.push("/admin/expenses"); }}>Reset</Button>
            <div className="ml-auto text-sm font-medium">
              Total: <span className="text-lg">{formatRupiah(totalAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader><CardTitle>Daftar Pengeluaran ({expenses.length})</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/10 text-left text-muted-foreground">
                <th className="pb-2 font-medium">Tanggal</th>
                <th className="pb-2 font-medium">Jumlah</th>
                <th className="pb-2 font-medium">Keterangan</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-foreground/5">
                  <td className="py-2 text-xs text-muted-foreground">
                    {formatDateTime(e.recordedAt, "medium")}
                  </td>
                  <td className="py-2 font-medium">{formatRupiah(e.amount)}</td>
                  <td className="py-2 text-muted-foreground">{e.note ?? "—"}</td>
                  <td className="py-2">
                    <Button size="xs" variant="destructive" disabled={isPending}
                      onClick={() => { if (confirm("Hapus pengeluaran ini?")) run(() => deleteExpense(e.id)); }}>
                      Hapus
                    </Button>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <TableEmptyRow colSpan={4} message="Belum ada pengeluaran." />
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
