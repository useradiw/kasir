"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
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

const UNIT_SUGGESTIONS = ["pcs", "gr", "kg", "ml", "ltr", "btl", "bks", "dus", "lbr"];

type Template = { id: string; name: string; defaultUnit: string | null; defaultCost: number | null };

type ExpenseItemRow = {
  id: string;
  description: string;
  amount: number;
  cost: number;
  unit: string;
  templateId: string | null;
};

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

function ItemRow({
  item,
  templates,
  uniquePastNames,
  isPending,
  onUpdate,
  onApplyTemplate,
  onApplyPastName,
  onRemove,
  canRemove,
}: {
  item: ExpenseItemRow;
  templates: Template[];
  uniquePastNames: string[];
  isPending: boolean;
  onUpdate: (id: string, field: keyof Omit<ExpenseItemRow, "id">, value: string | number | null) => void;
  onApplyTemplate: (rowId: string, template: Template) => void;
  onApplyPastName: (rowId: string, name: string) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}) {
  const [query, setQuery] = useState(item.description);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const q = query.toLowerCase();
  const filteredTemplates = templates.filter((t) => t.name.toLowerCase().includes(q));
  const filteredPast = uniquePastNames.filter((n) => n.toLowerCase().includes(q));
  const hasSuggestions = filteredTemplates.length > 0 || filteredPast.length > 0;

  function handleDescriptionChange(val: string) {
    setQuery(val);
    onUpdate(item.id, "description", val);
    onUpdate(item.id, "templateId", null);
    setShowDropdown(true);
  }

  function selectTemplate(t: Template) {
    setQuery(t.name);
    onApplyTemplate(item.id, t);
    setShowDropdown(false);
  }

  function selectPast(name: string) {
    setQuery(name);
    onApplyPastName(item.id, name);
    setShowDropdown(false);
  }

  return (
    <div className="space-y-2 rounded-lg border border-foreground/10 p-2.5">
      {/* Description with autocomplete */}
      <div className="relative" ref={dropdownRef}>
        <Input
          placeholder="Nama item"
          value={query}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          required
          disabled={isPending}
        />
        {showDropdown && hasSuggestions && (
          <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-md max-h-48 overflow-y-auto">
            {filteredTemplates.length > 0 && (
              <>
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Template</p>
                {filteredTemplates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); selectTemplate(t); }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center justify-between"
                  >
                    <span>{t.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.defaultUnit ?? ""}{t.defaultCost != null ? ` · ${formatRupiah(t.defaultCost)}` : ""}
                    </span>
                  </button>
                ))}
              </>
            )}
            {filteredPast.length > 0 && (
              <>
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Riwayat</p>
                {filteredPast.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); selectPast(name); }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent"
                  >
                    {name}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Amount, Unit, Cost, Remove */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Input
            type="number"
            placeholder="Qty"
            min={0.001}
            step="any"
            value={item.amount || ""}
            onChange={(e) => onUpdate(item.id, "amount", parseFloat(e.target.value) || 0)}
            required
            disabled={isPending}
            className="w-20"
          />
          <input
            list={`units-${item.id}`}
            value={item.unit}
            onChange={(e) => onUpdate(item.id, "unit", e.target.value)}
            placeholder="satuan"
            disabled={isPending}
            className="h-9 w-20 rounded-4xl border border-input bg-input/30 px-2 text-sm focus:outline-none"
          />
          <datalist id={`units-${item.id}`}>
            {UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}
          </datalist>
        </div>
        <span className="text-muted-foreground text-sm">×</span>
        <Input
          type="number"
          placeholder="Biaya/satuan"
          min={0}
          value={item.cost || ""}
          onChange={(e) => onUpdate(item.id, "cost", parseInt(e.target.value) || 0)}
          required
          disabled={isPending}
          className="w-28"
        />
        <span className="text-xs text-muted-foreground ml-auto">
          = {formatRupiah(item.amount * item.cost)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(item.id)}
          disabled={isPending || !canRemove}
          className="shrink-0"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
