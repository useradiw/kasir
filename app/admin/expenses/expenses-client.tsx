"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBanner } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { computeExpenseTotal } from "@/lib/expense-utils";
import { addExpense, updateExpense, deleteExpense } from "@/app/actions/admin/expenses";
import { ExpenseForm } from "@/components/expenses/expense-form";

type ExpenseItem = { id: string; description: string; amount: number; cost: number };
type Expense = {
  id: string;
  description: string | null;
  deductFromCash: boolean;
  recordedAt: string;
  createdAt: string;
  staffName: string | null;
  items: ExpenseItem[];
};

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
  const confirm = useConfirm();
  const [localFilters, setLocalFilters] = useState(filters);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addFormKey, setAddFormKey] = useState(0);

  function applyFilters() {
    const params = new URLSearchParams();
    if (localFilters.from) params.set("from", localFilters.from);
    if (localFilters.to) params.set("to", localFilters.to);
    router.push(`/admin/expenses?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pengeluaran</h1>
        <Button size="sm" onClick={() => { setShowAdd((v) => !v); setEditId(null); }}>
          {showAdd ? "Batal" : "+ Tambah"}
        </Button>
      </div>

      <ErrorBanner error={error} />

      {/* Add form */}
      {showAdd && (
        <Card>
          <CardHeader><CardTitle>Tambah Pengeluaran</CardTitle></CardHeader>
          <CardContent>
            <ExpenseForm
              key={addFormKey}
              mode="add"
              isPending={isPending}
              onSubmit={(data) =>
                run(() => addExpense(data), {
                  successMessage: "Pengeluaran berhasil ditambahkan",
                  onSuccess: () => setAddFormKey((k) => k + 1),
                })
              }
            />
          </CardContent>
        </Card>
      )}

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
              {expenses.map((e) => {
                const total = computeExpenseTotal(e.items);
                const isExpanded = expandedId === e.id;
                const isEditing = editId === e.id;

                return (
                  <div key={e.id} className="py-3">
                    {isEditing ? (
                      <ExpenseForm
                        mode="edit"
                        isPending={isPending}
                        defaultValues={{
                          description: e.description ?? undefined,
                          deductFromCash: e.deductFromCash,
                          items: e.items.map((i) => ({
                            description: i.description,
                            amount: i.amount,
                            cost: i.cost,
                          })),
                        }}
                        onSubmit={(data) =>
                          run(() => updateExpense(e.id, data), {
                            successMessage: "Pengeluaran berhasil diperbarui",
                            onSuccess: () => setEditId(null),
                          })
                        }
                        onCancel={() => setEditId(null)}
                      />
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : e.id)}
                            className="flex items-start gap-2 min-w-0 text-left"
                          >
                            {isExpanded ? <ChevronDown className="size-4 mt-0.5 shrink-0" /> : <ChevronRight className="size-4 mt-0.5 shrink-0" />}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{formatRupiah(total)}</p>
                                {!e.deductFromCash && (
                                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                    Non-kas
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(e.recordedAt, "medium")}
                                {e.staffName && <> &middot; {e.staffName}</>}
                              </p>
                              {e.description && <p className="text-xs text-muted-foreground mt-0.5">{e.description}</p>}
                            </div>
                          </button>
                          <div className="flex gap-1.5 shrink-0">
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => { setEditId(e.id); setShowAdd(false); }}
                            >
                              Edit
                            </Button>
                            {isOwner && (
                              <Button
                                size="xs"
                                variant="destructive"
                                disabled={isPending}
                                onClick={async () => { if (await confirm({ title: "Hapus pengeluaran ini?", destructive: true, confirmLabel: "Hapus" })) run(() => deleteExpense(e.id), { successMessage: "Pengeluaran dihapus" }); }}
                              >
                                Hapus
                              </Button>
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="ml-6 mt-2 space-y-1">
                            {e.items.map((item) => (
                              <div key={item.id} className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{item.description}</span>
                                <span>{item.amount} &times; {formatRupiah(item.cost)} = {formatRupiah(item.amount * item.cost)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
