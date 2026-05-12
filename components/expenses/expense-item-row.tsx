"use client";

import { useState, useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRupiah } from "@/lib/format";

const UNIT_SUGGESTIONS = ["pcs", "gr", "kg", "ml", "ltr", "btl", "bks", "dus", "lbr"];

export type Template = { id: string; name: string; defaultUnit: string | null; defaultCost: number | null };

export type ExpenseItemRow = {
  id: string;
  description: string;
  amount: number;
  cost: number;
  unit: string;
  templateId: string | null;
};

export function ItemRow({
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
