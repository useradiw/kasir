"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBanner } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { addExpense, deleteExpense } from "@/app/actions/admin/expenses";

type Expense = { id: string; amount: number; note: string | null; recordedAt: string; createdAt: string };

export default function ExpensesClient({
  expenses,
  totalAmount,
  filters,
  isOwner,
}: {
  expenses: Expense[];
  totalAmount: number;
  filters: { from: string; to: string };
  isOwner: boolean;
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
              <Input name="note" placeholder="Keterangan (opsional)" />
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
          {expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Belum ada pengeluaran.</p>
          ) : (
            <div className="divide-y divide-foreground/5">
              {expenses.map((e) => (
                <div key={e.id} className="flex items-start justify-between py-2.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{formatRupiah(e.amount)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(e.recordedAt, "medium")}</p>
                    {e.note && <p className="text-xs text-muted-foreground mt-0.5">{e.note}</p>}
                  </div>
                  {isOwner && (
                    <Button
                      size="xs"
                      variant="destructive"
                      disabled={isPending}
                      className="shrink-0"
                      onClick={() => { if (confirm("Hapus pengeluaran ini?")) run(() => deleteExpense(e.id)); }}
                    >
                      Hapus
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
