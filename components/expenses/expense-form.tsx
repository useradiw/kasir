"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { formatRupiah } from "@/lib/format";
import { computeExpenseTotal } from "@/lib/expense-utils";

type ExpenseItemRow = {
  id: string;
  description: string;
  amount: number;
  cost: number;
};

type Props = {
  mode: "add" | "edit";
  isPending: boolean;
  onSubmit: (data: {
    description?: string;
    items: { description: string; amount: number; cost: number }[];
  }) => void;
  defaultValues?: {
    description?: string;
    items: { description: string; amount: number; cost: number }[];
  };
  onCancel?: () => void;
};

let nextId = 0;
function createRow(defaults?: { description: string; amount: number; cost: number }): ExpenseItemRow {
  return {
    id: `row-${++nextId}`,
    description: defaults?.description ?? "",
    amount: defaults?.amount ?? 1,
    cost: defaults?.cost ?? 0,
  };
}

export function ExpenseForm({ mode, isPending, onSubmit, defaultValues, onCancel }: Props) {
  const [description, setDescription] = useState(defaultValues?.description ?? "");
  const [items, setItems] = useState<ExpenseItemRow[]>(() =>
    defaultValues?.items?.length
      ? defaultValues.items.map((i) => createRow(i))
      : [createRow()],
  );

  function updateItem(id: string, field: keyof Omit<ExpenseItemRow, "id">, value: string | number) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  }

  function addRow() {
    setItems((prev) => [...prev, createRow()]);
  }

  function removeRow(id: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  }

  const grandTotal = computeExpenseTotal(items);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      description: description || undefined,
      items: items.map(({ description, amount, cost }) => ({ description, amount, cost })),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-1.5">
        <Label htmlFor="expense-desc">Keterangan (opsional)</Label>
        <Input
          id="expense-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Keterangan umum"
          disabled={isPending}
        />
      </div>

      <div className="space-y-3">
        <Label>Item Pengeluaran</Label>
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-2">
            <div className="grid gap-1 flex-1 min-w-0">
              <Input
                placeholder="Deskripsi"
                value={item.description}
                onChange={(e) => updateItem(item.id, "description", e.target.value)}
                required
                disabled={isPending}
              />
            </div>
            <div className="grid gap-1 w-20">
              <Input
                type="number"
                placeholder="Qty"
                min={1}
                value={item.amount || ""}
                onChange={(e) => updateItem(item.id, "amount", parseInt(e.target.value) || 0)}
                required
                disabled={isPending}
              />
            </div>
            <div className="grid gap-1 w-28">
              <Input
                type="number"
                placeholder="Biaya"
                min={0}
                value={item.cost || ""}
                onChange={(e) => updateItem(item.id, "cost", parseInt(e.target.value) || 0)}
                required
                disabled={isPending}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeRow(item.id)}
              disabled={isPending || items.length <= 1}
              className="shrink-0 mt-0.5"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={isPending}>
          <Plus className="size-4" />
          Tambah Item
        </Button>
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <div className="text-sm font-medium">
          Total: <span className="text-lg">{formatRupiah(grandTotal)}</span>
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
              Batal
            </Button>
          )}
          <Button type="submit" disabled={isPending || items.every((i) => !i.description)}>
            {isPending ? (
              <>
                <Spinner />
                Menyimpan...
              </>
            ) : mode === "add" ? (
              "Tambah Pengeluaran"
            ) : (
              "Simpan Perubahan"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
