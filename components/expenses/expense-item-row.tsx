"use client";

import { useState, useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import { formatRpPerUnit } from "@/lib/format";

export type IngredientOption = {
  id:              string;
  name:            string;
  baseUnit:        string;
  averageUnitCost: number;
  category:        string;
};

// Legacy shape kept for backward compat during transition
export type Template = { id: string; name: string; defaultUnit: string | null; defaultCost: number | null };

export type ExpenseItemRow = {
  id:           string;
  description:  string;
  amount:       number;
  cost:         number;  // per-unit (derived from total ÷ amount); stored on ExpenseItem
  total:        number | null; // exact line total paid; source of truth (new rows); null = legacy fallback
  unit:         string;
  templateId:   string | null; // legacy
  ingredientId: string | null; // new
};

export function ItemRow({
  item,
  ingredients,
  uniquePastNames,
  isPending,
  onUpdate,
  onApplyIngredient,
  onApplyPastName,
  onRemove,
  canRemove,
}: {
  item:             ExpenseItemRow;
  ingredients:      IngredientOption[];
  uniquePastNames:  string[];
  isPending:        boolean;
  onUpdate:         (id: string, field: keyof Omit<ExpenseItemRow, "id">, value: string | number | null) => void;
  onApplyIngredient:(rowId: string, ing: IngredientOption) => void;
  onApplyPastName:  (rowId: string, name: string) => void;
  onRemove:         (id: string) => void;
  canRemove:        boolean;
}) {
  const [query, setQuery]           = useState(item.description);
  const [showDropdown, setShowDropdown] = useState(false);
  // Total paid for this line is the user-facing source of truth; per-unit cost is derived.
  const [total, setTotal] = useState<number | null>(
    item.amount > 0 && item.cost > 0 ? Math.round(item.amount * item.cost) : null,
  );
  const [qty, setQty] = useState<number | null>(item.amount > 0 ? item.amount : null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedIngredient = item.ingredientId
    ? ingredients.find((i) => i.id === item.ingredientId)
    : null;
  const unitLabel = selectedIngredient ? selectedIngredient.baseUnit : (item.unit || "satuan");
  const perUnit = total != null && qty != null && qty > 0 ? total / qty : 0;

  // Push derived per-unit cost + qty + exact total up to the parent whenever total/qty change.
  function pushDerived(nextQty: number | null, nextTotal: number | null) {
    const c = nextQty != null && nextQty > 0 && nextTotal != null ? Math.round(nextTotal / nextQty) : 0;
    onUpdate(item.id, "amount", nextQty ?? 0);
    onUpdate(item.id, "cost", c);
  }
  function handleQty(v: number | null) { setQty(v); pushDerived(v, total); }
  function handleTotal(v: number | null) {
    setTotal(v);
    onUpdate(item.id, "total", v !== null ? Math.round(v) : null);
    pushDerived(qty, v);
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const q              = query.toLowerCase();
  const filteredIngs   = ingredients.filter((i) => i.name.toLowerCase().includes(q));
  const filteredPast   = uniquePastNames.filter((n) => n.toLowerCase().includes(q));
  const hasSuggestions = filteredIngs.length > 0 || filteredPast.length > 0;

  function handleDescriptionChange(val: string) {
    setQuery(val);
    onUpdate(item.id, "description", val);
    onUpdate(item.id, "ingredientId", null);
    onUpdate(item.id, "templateId", null);
    setShowDropdown(true);
  }

  function selectIngredient(ing: IngredientOption) {
    setQuery(ing.name);
    onApplyIngredient(item.id, ing);
    setShowDropdown(false);
  }
  function selectPast(name: string) {
    setQuery(name);
    onApplyPastName(item.id, name);
    setShowDropdown(false);
  }

  const categoryLabel: Record<string, string> = {
    BAHAN: "Bahan", KEMASAN: "Kemasan", PERLENGKAPAN: "Perlengkapan", LAINNYA: "Lainnya",
  };

  return (
    <div className="space-y-2.5 rounded-2xl border bg-card p-3">
      {/* Description with autocomplete */}
      <div className="relative" ref={dropdownRef}>
        <Input
          placeholder="Nama item / bahan"
          value={query}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          required
          disabled={isPending}
        />
        {item.ingredientId && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-primary">
            <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5">
              {categoryLabel[selectedIngredient?.category ?? ""] ?? ""}
            </span>
            <span className="tabular-nums">HPP terakhir {formatRpPerUnit(selectedIngredient?.averageUnitCost ?? 0)}/{selectedIngredient?.baseUnit ?? ""}</span>
          </div>
        )}
        {showDropdown && hasSuggestions && (
          <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-xl shadow-md max-h-52 overflow-y-auto">
            {filteredIngs.length > 0 && (
              <>
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Bahan / Kemasan</p>
                {filteredIngs.map((ing) => (
                  <button
                    key={ing.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); selectIngredient(ing); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{ing.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                      {ing.baseUnit}
                      {ing.averageUnitCost > 0 ? ` · ${formatRpPerUnit(ing.averageUnitCost)}/${ing.baseUnit}` : ""}
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
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                  >
                    {name}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Qty (in the ingredient's unit) + Total paid */}
      <div className="flex items-end gap-2">
        <div className="grid gap-1 flex-1">
          <Label className="text-xs text-muted-foreground">Jumlah ({unitLabel})</Label>
          <div className="flex items-center gap-1.5">
            <DecimalInput
              placeholder="0"
              defaultValue={item.amount || null}
              onValueChange={handleQty}
              required
              disabled={isPending}
              className="w-full"
            />
            {!selectedIngredient && (
              <Input
                value={item.unit}
                onChange={(e) => onUpdate(item.id, "unit", e.target.value)}
                placeholder="satuan"
                disabled={isPending}
                className="w-24"
              />
            )}
          </div>
        </div>
        <div className="grid gap-1 flex-1">
          <Label className="text-xs text-muted-foreground">Total bayar (Rp)</Label>
          <DecimalInput
            placeholder="0"
            defaultValue={total}
            onValueChange={handleTotal}
            maxDecimals={0}
            required
            disabled={isPending}
            className="w-full"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(item.id)}
          disabled={isPending || !canRemove}
          aria-label="Hapus item"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* Derived per-unit hint (only when both filled) */}
      {perUnit > 0 && (
        <p className="text-xs text-muted-foreground tabular-nums">
          ≈ {formatRpPerUnit(perUnit)}/{unitLabel}
          {selectedIngredient && (
            <span className="text-muted-foreground/60"> · jumlah dalam {selectedIngredient.baseUnit} (mis. 2 dus = 60 {selectedIngredient.baseUnit})</span>
          )}
        </p>
      )}
    </div>
  );
}
