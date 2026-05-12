"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { formatRupiah } from "@/lib/format";
import { computeExpenseTotal } from "@/lib/expense-utils";
import {
  getExpenseTemplates,
  getDistinctExpenseItemNames,
} from "@/app/actions/admin/expense-templates";
import { ItemRow, type ExpenseItemRow, type Template } from "./expense-item-row";

type Props = {
  mode: "add" | "edit";
  isPending: boolean;
  onSubmit: (data: {
    description?: string;
    deductFromCash: boolean;
    countToKasPakHar: boolean;
    items: { description: string; amount: number; cost: number; unit?: string; templateId?: string | null }[];
  }) => void;
  defaultValues?: {
    description?: string;
    deductFromCash?: boolean;
    countToKasPakHar?: boolean;
    items: { description: string; amount: number; cost: number; unit?: string; templateId?: string | null }[];
  };
  onCancel?: () => void;
};

let nextId = 0;
function createRow(defaults?: { description: string; amount: number; cost: number; unit?: string; templateId?: string | null }): ExpenseItemRow {
  return {
    id: `row-${++nextId}`,
    description: defaults?.description ?? "",
    amount: defaults?.amount ?? 1,
    cost: defaults?.cost ?? 0,
    unit: defaults?.unit ?? "",
    templateId: defaults?.templateId ?? null,
  };
}

export function ExpenseForm({ mode, isPending, onSubmit, defaultValues, onCancel }: Props) {
  const [description, setDescription] = useState(defaultValues?.description ?? "");
  const [deductFromCash, setDeductFromCash] = useState(defaultValues?.deductFromCash ?? true);
  const [countToKasPakHar, setCountToKasPakHar] = useState(defaultValues?.countToKasPakHar ?? false);
  const [items, setItems] = useState<ExpenseItemRow[]>(() =>
    defaultValues?.items?.length
      ? defaultValues.items.map((i) => createRow(i))
      : [createRow()],
  );

  // Suggestions: templates + distinct past item names
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pastNames, setPastNames] = useState<string[]>([]);
  useEffect(() => {
    getExpenseTemplates().then(setTemplates).catch(() => {});
    getDistinctExpenseItemNames().then(setPastNames).catch(() => {});
  }, []);

  function updateItem(id: string, field: keyof Omit<ExpenseItemRow, "id">, value: string | number | null) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  }

  function applyTemplate(rowId: string, template: Template) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === rowId
          ? {
              ...item,
              description: template.name,
              unit: template.defaultUnit ?? item.unit,
              cost: template.defaultCost ?? item.cost,
              templateId: template.id,
            }
          : item,
      ),
    );
  }

  function applyPastName(rowId: string, name: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === rowId ? { ...item, description: name, templateId: null } : item,
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      description: description || undefined,
      deductFromCash,
      countToKasPakHar,
      items: items.map(({ description, amount, cost, unit, templateId }) => ({
        description,
        amount,
        cost,
        unit: unit || undefined,
        templateId: templateId || null,
      })),
    });
  }

  // Build suggestion list: templates first, then unique past names not already in templates
  const templateNames = new Set(templates.map((t) => t.name));
  const uniquePastNames = pastNames.filter((n) => !templateNames.has(n));

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

      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={deductFromCash}
            onChange={(e) => {
              setDeductFromCash(e.target.checked);
              if (e.target.checked) setCountToKasPakHar(false);
            }}
            disabled={isPending}
            className="rounded"
          />
          Kurangi dari kas
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={countToKasPakHar}
            onChange={(e) => {
              setCountToKasPakHar(e.target.checked);
              if (e.target.checked) setDeductFromCash(false);
            }}
            disabled={isPending}
            className="rounded"
          />
          Kurangi dari kas pak har
        </label>
      </div>

      <div className="space-y-3">
        <Label>Item Pengeluaran</Label>
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            templates={templates}
            uniquePastNames={uniquePastNames}
            isPending={isPending}
            onUpdate={updateItem}
            onApplyTemplate={applyTemplate}
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
