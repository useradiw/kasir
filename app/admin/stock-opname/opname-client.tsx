"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { AdminPageHeader, ErrorBanner } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { formatDateTime } from "@/lib/format";
import { submitOpname } from "@/app/actions/admin/opname";

type Ingredient = { id: string; name: string; category: string; baseUnit: string; currentStock: number };
type OpnameLine = { ingredientId: string; countedQty: number | null };

type HistoryLine = {
  id: string;
  ingredientId: string;
  systemQty: number;
  countedQty: number;
  delta: number;
  ingredient: { name: string; baseUnit: string };
};
type HistoryItem = {
  id: string;
  performedAt: Date;
  notes: string | null;
  performedBy: { name: string | null } | null;
  lines: HistoryLine[];
};

const CATEGORY_ORDER = ["BAHAN", "KEMASAN", "PERLENGKAPAN", "LAINNYA"];

export default function OpnameClient({
  history,
  ingredients,
}: {
  history: HistoryItem[];
  ingredients: Ingredient[];
}) {
  const { isPending, run, error } = useAdminAction();
  const [mode, setMode] = useState<"list" | "form">("list");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lines, setLines] = useState<OpnameLine[]>(() =>
    ingredients.map((i) => ({ ingredientId: i.id, countedQty: i.currentStock }))
  );
  const [opnameNotes, setOpnameNotes] = useState("");

  function updateLine(ingredientId: string, value: number | null) {
    setLines((prev) => prev.map((l) => l.ingredientId === ingredientId ? { ...l, countedQty: value } : l));
  }

  async function handleSubmit() {
    const parsed = lines.filter(
      (l): l is { ingredientId: string; countedQty: number } => l.countedQty !== null,
    );

    await run(
      () => submitOpname({ notes: opnameNotes || undefined, lines: parsed }),
      { successMessage: "Opname berhasil disimpan", onSuccess: () => { setMode("list"); setOpnameNotes(""); } },
    );
  }

  const sortedIngredients = [...ingredients].sort((a, b) => {
    const catDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    return catDiff !== 0 ? catDiff : a.name.localeCompare(b.name);
  });

  if (mode === "form") {
    return (
      <div className="space-y-4">
        <AdminPageHeader title="Mulai Opname Stok">
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setMode("list")}>Batal</Button>
            <Button size="sm" disabled={isPending} onClick={handleSubmit}>Simpan Opname</Button>
          </div>
        </AdminPageHeader>

        <ErrorBanner error={error} />

        <p className="text-sm text-muted-foreground">
          Isi jumlah fisik yang dihitung untuk setiap bahan. Sistem akan mencatat selisih vs stok tercatat.
        </p>

        <Card>
          <CardContent className="pt-4 space-y-1">
            <div className="mb-3">
              <Input
                placeholder="Catatan opname (opsional)"
                value={opnameNotes}
                onChange={(e) => setOpnameNotes(e.target.value)}
              />
            </div>

            {sortedIngredients.map((ing, idx) => {
              const line = lines.find((l) => l.ingredientId === ing.id);
              if (!line) return null;
              const counted = line.countedQty;
              const delta   = counted === null ? null : counted - ing.currentStock;
              const prevCat = idx > 0 ? sortedIngredients[idx - 1].category : null;
              const showCat = prevCat !== ing.category;

              return (
                <div key={ing.id}>
                  {showCat && (
                    <p className="pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {ing.category}
                    </p>
                  )}
                  <div className="flex items-center gap-3 py-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{ing.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        Sistem: {ing.currentStock % 1 === 0 ? ing.currentStock.toFixed(0) : ing.currentStock.toFixed(2)} {ing.baseUnit}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <DecimalInput
                        defaultValue={line.countedQty}
                        onValueChange={(v) => updateLine(ing.id, v)}
                        className="w-24 h-8 text-sm tabular-nums text-right"
                      />
                      <span className="text-xs text-muted-foreground w-8">{ing.baseUnit}</span>
                      {delta !== null && (
                        <span className={`text-xs font-medium w-16 text-right tabular-nums ${delta > 0 ? "text-green-600 dark:text-green-400" : delta < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {delta > 0 ? "+" : ""}{delta % 1 === 0 ? delta.toFixed(0) : delta.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button disabled={isPending} onClick={handleSubmit}>Simpan Opname</Button>
          <Button variant="ghost" onClick={() => setMode("list")}>Batal</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Opname Stok">
        <Button size="sm" onClick={() => setMode("form")}>+ Mulai Opname</Button>
      </AdminPageHeader>

      <ErrorBanner error={error} />

      <Card>
        <CardHeader><CardTitle>Riwayat Opname ({history.length})</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Belum ada opname. Mulai opname pertama.</p>
          ) : (
            <div className="divide-y divide-foreground/5">
              {history.map((h) => {
                const adjustments = h.lines.filter((l) => l.delta !== 0);
                const isExpanded  = expandedId === h.id;
                return (
                  <div key={h.id} className="py-3">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : h.id)}
                      className="w-full text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-lg"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{formatDateTime(h.performedAt)}</p>
                          <p className="text-xs text-muted-foreground">
                            {h.lines.length} bahan diperiksa
                            {adjustments.length > 0 && <> · {adjustments.length} penyesuaian</>}
                            {h.performedBy?.name && <> · {h.performedBy.name}</>}
                          </p>
                          {h.notes && <p className="text-xs text-muted-foreground">{h.notes}</p>}
                        </div>
                        <span className="text-muted-foreground/40 text-lg shrink-0">{isExpanded ? "˅" : "›"}</span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-2 ml-1 space-y-1">
                        {h.lines.filter((l) => l.delta !== 0).map((l) => (
                          <div key={l.id} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{l.ingredient.name}</span>
                            <span className="tabular-nums">
                              {l.systemQty % 1 === 0 ? l.systemQty.toFixed(0) : l.systemQty.toFixed(2)}
                              {" → "}
                              {l.countedQty % 1 === 0 ? l.countedQty.toFixed(0) : l.countedQty.toFixed(2)}
                              {" "}
                              {l.ingredient.baseUnit}
                              {" "}
                              <span className={l.delta > 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}>
                                ({l.delta > 0 ? "+" : ""}{l.delta % 1 === 0 ? l.delta.toFixed(0) : l.delta.toFixed(2)})
                              </span>
                            </span>
                          </div>
                        ))}
                        {h.lines.filter((l) => l.delta === 0).length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            +{h.lines.filter((l) => l.delta === 0).length} bahan tidak berubah
                          </p>
                        )}
                      </div>
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
