"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { AdminSelect } from "@/components/admin/ui";
import { formatRupiah } from "@/lib/format";
import { computeExpenseTotal } from "@/lib/expense-utils";
import { getDistinctExpenseItemNames } from "@/app/actions/admin/expense-templates";
import { getSuppliers } from "@/app/actions/admin/suppliers";
import { ItemRow, type ExpenseItemRow, type IngredientOption } from "./expense-item-row";

type Supplier = { id: string; name: string; phone: string | null };

type Props = {
  mode: "add" | "edit";
  isPending: boolean;
  ingredients: IngredientOption[];  // passed in from parent (server-fetched or client-loaded)
  onSubmit: (data: {
    description?: string;
    supplierId?: string | null;
    deductFromCash: boolean;
    countToKasPakHar: boolean;
    items: {
      description:  string;
      amount:       number;
      cost:         number;
      total?:       number;
      unit?:        string;
      templateId?:  string | null;
      ingredientId?: string | null;
    }[];
  }) => void;
  defaultValues?: {
    description?: string;
    supplierId?: string | null;
    deductFromCash?: boolean;
    countToKasPakHar?: boolean;
    items: {
      description:  string;
      amount:       number;
      cost:         number;
      total?:       number;
      unit?:        string;
      templateId?:  string | null;
      ingredientId?: string | null;
    }[];
  };
  onCancel?: () => void;
};

let nextId = 0;
function createRow(defaults?: {
  description: string; amount: number; cost: number; total?: number;
  unit?: string; templateId?: string | null; ingredientId?: string | null;
}): ExpenseItemRow {
  return {
    id:           `row-${++nextId}`,
    description:  defaults?.description ?? "",
    amount:       defaults?.amount ?? 1,
    cost:         defaults?.cost ?? 0,
    total:        defaults?.total ?? (defaults?.amount && defaults?.cost ? Math.round(defaults.amount * defaults.cost) : null),
    unit:         defaults?.unit ?? "",
    templateId:   defaults?.templateId ?? null,
    ingredientId: defaults?.ingredientId ?? null,
  };
}

export function ExpenseForm({
  mode, isPending, ingredients, onSubmit, defaultValues, onCancel,
}: Props) {
  const [description,      setDescription]      = useState(defaultValues?.description ?? "");
  const [supplierId,       setSupplierId]        = useState<string>(defaultValues?.supplierId ?? "");
  const [deductFromCash,   setDeductFromCash]    = useState(defaultValues?.deductFromCash ?? true);
  const [countToKasPakHar, setCountToKasPakHar] = useState(defaultValues?.countToKasPakHar ?? false);
  const [items, setItems] = useState<ExpenseItemRow[]>(() =>
    defaultValues?.items?.length
      ? defaultValues.items.map((i) => createRow(i))
      : [createRow()],
  );

  const [suppliers,    setSuppliers]    = useState<Supplier[]>([]);
  const [pastNames,    setPastNames]    = useState<string[]>([]);

  useEffect(() => {
    getSuppliers().then(setSuppliers).catch(() => {});
    getDistinctExpenseItemNames().then(setPastNames).catch(() => {});
  }, []);

  function updateItem(id: string, field: keyof Omit<ExpenseItemRow, "id">, value: string | number | null) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  }

  function applyIngredient(rowId: string, ing: IngredientOption) {
    // Quantity is entered in the ingredient's own unit; the user types the TOTAL
    // they paid (per-unit cost is derived). We don't prefill cost — the "HPP
    // terakhir" chip on the row already shows the reference price.
    setItems((prev) =>
      prev.map((item) =>
        item.id === rowId
          ? { ...item, description: ing.name, unit: ing.unit, ingredientId: ing.id, templateId: null }
          : item,
      ),
    );
  }

  function applyPastName(rowId: string, name: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === rowId
          ? { ...item, description: name, ingredientId: null, templateId: null }
          : item,
      ),
    );
  }

  function addRow() {
    setItems((prev) => [...prev, createRow()]);
  }

  function removeRow(id: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  }

  const grandTotal = computeExpenseTotal(items);

  // Past names not already in ingredient list
  const ingNames      = new Set(ingredients.map((i) => i.name));
  const uniquePastNames = pastNames.filter((n) => !ingNames.has(n));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      description:      description || undefined,
      supplierId:       supplierId || null,
      deductFromCash,
      countToKasPakHar,
      items: items.map(({ description, amount, cost, total, unit, ingredientId }) => ({
        description,
        amount,
        cost,
        total:        total ?? undefined,
        unit:         unit || undefined,
        templateId:   null,
        ingredientId: ingredientId ?? null,
      })),
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

      {suppliers.length > 0 && (
        <div className="grid gap-1.5">
          <Label>Supplier (opsional)</Label>
          <AdminSelect value={supplierId} onChange={(e) => setSupplierId(e.target.value)} disabled={isPending}>
            <option value="">— Pilih supplier —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.phone ? ` · ${s.phone}` : ""}</option>
            ))}
          </AdminSelect>
        </div>
      )}

      <div className="grid gap-1.5">
        <Label>Sumber dana</Label>
        <div className="flex gap-1.5">
          {([
            { key: "kas",  label: "Kurangi Kas",  on: () => { setDeductFromCash(true);  setCountToKasPakHar(false); }, active: deductFromCash },
            { key: "kph",  label: "Kas Pak Har",  on: () => { setDeductFromCash(false); setCountToKasPakHar(true);  }, active: countToKasPakHar },
            { key: "none", label: "Tidak ada",    on: () => { setDeductFromCash(false); setCountToKasPakHar(false); }, active: !deductFromCash && !countToKasPakHar },
          ] as const).map((opt) => (
            <Button
              key={opt.key}
              type="button"
              size="sm"
              variant={opt.active ? "default" : "outline"}
              onClick={opt.on}
              disabled={isPending}
              className="flex-1"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label>Item Pengeluaran</Label>
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            ingredients={ingredients}
            uniquePastNames={uniquePastNames}
            isPending={isPending}
            onUpdate={updateItem}
            onApplyIngredient={applyIngredient}
            onApplyPastName={applyPastName}
            onRemove={removeRow}
            canRemove={items.length > 1}
          />
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
              <><Spinner /> Menyimpan...</>
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
