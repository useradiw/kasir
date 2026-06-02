"use client";

import { useState, useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { formatRupiah, formatRpPerUnit } from "@/lib/format";

export type IngredientOption = {
  id:              string;
  name:            string;
  baseUnit:        string;
  averageUnitCost: number;
  category:        string;
  packs:           { label: string; baseQty: number; isDefault: boolean }[];
};

// Legacy shape kept for backward compat during transition
export type Template = { id: string; name: string; defaultUnit: string | null; defaultCost: number | null };

export type ExpenseItemRow = {
  id:           string;
  description:  string;
  amount:       number;
  cost:         number;
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedIngredient = item.ingredientId
    ? ingredients.find((i) => i.id === item.ingredientId)
    : null;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const q               = query.toLowerCase();
  const filteredIngs    = ingredients.filter((i) => i.name.toLowerCase().includes(q));
  const filteredPast    = uniquePastNames.filter((n) => n.toLowerCase().includes(q));
  const hasSuggestions  = filteredIngs.length > 0 || filteredPast.length > 0;

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
    <div className="space-y-2 rounded-lg border border-foreground/10 p-2.5">
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
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-primary">
            <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5">
              {categoryLabel[selectedIngredient?.category ?? ""] ?? ""}
            </span>
            <span>· HPP rata-rata {formatRpPerUnit(selectedIngredient?.averageUnitCost ?? 0)}/{selectedIngredient?.baseUnit ?? ""}</span>
          </div>
        )}
        {showDropdown && hasSuggestions && (
          <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-md max-h-52 overflow-y-auto">
            {filteredIngs.length > 0 && (
              <>
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Bahan / Kemasan</p>
                {filteredIngs.map((ing) => (
                  <button
                    key={ing.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); selectIngredient(ing); }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{ing.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
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

      {/* When an ingredient is selected, the quantity is entered directly in the
          ingredient's unit (gram/ml/butir/…). Convert bulk buys (e.g. "2 dus")
          to that unit yourself, e.g. 60 butir. */}
      {selectedIngredient && (
        <p className="text-xs text-muted-foreground">
          Jumlah dalam satuan <strong>{selectedIngredient.baseUnit}</strong>. Untuk pembelian
          per dus/karton, isi total dalam {selectedIngredient.baseUnit} (mis. 2 dus = 60 {selectedIngredient.baseUnit}).
        </p>
      )}

      {/* Amount, Unit (text fallback), Cost, Remove */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <DecimalInput
            placeholder="Qty"
            defaultValue={item.amount}
            onValueChange={(v) => onUpdate(item.id, "amount", v ?? 0)}
            required
            disabled={isPending}
            className="w-20"
          />
          {/* Free-text unit only for unlinked (legacy) lines without an ingredient.
              When an ingredient is selected the satuan must come from the pack
              chips above so the server can look up the conversion. */}
          {!selectedIngredient && (
            <input
              list={`units-${item.id}`}
              value={item.unit}
              onChange={(e) => onUpdate(item.id, "unit", e.target.value)}
              placeholder="satuan"
              disabled={isPending}
              className="h-9 w-20 rounded-4xl border border-input bg-input/30 px-2 text-sm focus:outline-none"
            />
          )}
          {!selectedIngredient && (
            <datalist id={`units-${item.id}`}>
              {["pcs", "gr", "kg", "ml", "ltr", "btl", "bks", "dus", "lbr"].map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          )}
          {/* For a linked ingredient the unit is fixed to its own unit. */}
          {selectedIngredient && (
            <span className="text-xs text-muted-foreground font-medium">{selectedIngredient.baseUnit}</span>
          )}
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
          aria-label="Hapus item"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
