"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import { AdminSelect, AdminPageHeader, ErrorBanner } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { notify } from "@/lib/notify";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { addIngredientsBulk } from "@/app/actions/admin/ingredients";
import type { IngredientStockData } from "@/app/actions/admin/queries";

type Category = "BAHAN" | "KEMASAN" | "PERLENGKAPAN" | "LAINNYA";

type Row = IngredientStockData[number];

const CATEGORY_LABELS: Record<string, string> = {
  BAHAN:        "Bahan",
  KEMASAN:      "Kemasan",
  PERLENGKAPAN: "Perlengkapan",
  LAINNYA:      "Lainnya",
};

const CATEGORIES = ["SEMUA", "BAHAN", "KEMASAN", "PERLENGKAPAN", "LAINNYA"] as const;

export default function IngredientsClient({ data }: { data: IngredientStockData }) {
  const router = useRouter();
  const { isPending, run, error, setError } = useAdminAction();
  const [showAdd, setShowAdd] = useState(false);
  const [rowKeys, setRowKeys] = useState<number[]>([0]);
  const nextKey = useRef(1);
  const [activeCategory, setActiveCategory] = useState<string>("SEMUA");

  const lowCount = data.filter((d) => d.isLow && d.isActive).length;

  const filtered = activeCategory === "SEMUA"
    ? data
    : data.filter((d) => d.category === activeCategory);

  function resetRows() {
    setRowKeys([0]);
    nextKey.current = 1;
  }

  function handleBulkAdd(fd: FormData) {
    const names      = fd.getAll("name").map(String);
    const categories = fd.getAll("category").map(String);
    const baseUnits  = fd.getAll("baseUnit").map(String);
    const lowStocks  = fd.getAll("lowStockAlert").map(String);
    const notesArr   = fd.getAll("notes").map(String);

    const rows = names
      .map((name, i) => ({
        name:          name.trim(),
        category:      (categories[i] as Category) || "BAHAN",
        baseUnit:      (baseUnits[i] ?? "").trim(),
        lowStockAlert: lowStocks[i] ? parseFloat(lowStocks[i]) : null,
        notes:         notesArr[i]?.trim() || undefined,
      }))
      .filter((r) => r.name);

    if (rows.length === 0) { setError("Isi minimal satu nama bahan."); return; }
    if (rows.some((r) => !r.baseUnit)) {
      setError("Satuan dasar wajib diisi untuk setiap baris.");
      return;
    }

    run(
      async () => {
        const res = await addIngredientsBulk(rows);
        if (res.skipped.length > 0) {
          notify.info(
            `${res.created} bahan ditambahkan. ${res.skipped.length} dilewati (sudah ada): ${res.skipped.join(", ")}`,
          );
        } else {
          notify.success(`${res.created} bahan ditambahkan`);
        }
      },
      { onSuccess: () => { setShowAdd(false); resetRows(); } },
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Bahan Baku">
        <div className="flex items-center gap-2">
          {lowCount > 0 && (
            <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded-full font-medium">
              {lowCount} hampir habis
            </span>
          )}
          <Button size="sm" onClick={() => { setShowAdd((v) => !v); setError(null); }}>
            {showAdd ? "Batal" : "+ Tambah"}
          </Button>
        </div>
      </AdminPageHeader>

      <ErrorBanner error={error} />

      {/* Bulk add form */}
      {showAdd && (
        <Card>
          <CardContent className="pt-4">
            <form action={handleBulkAdd} className="space-y-3">
              <div className="space-y-3">
                {rowKeys.map((key) => (
                  <div
                    key={key}
                    className="flex flex-wrap gap-3 items-end border-b border-foreground/5 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="grid gap-1">
                      <Label>Nama Bahan</Label>
                      <Input name="name" placeholder="cth: Telur, Gula" className="w-44" />
                    </div>
                    <div className="grid gap-1">
                      <Label>Kategori</Label>
                      <AdminSelect name="category" defaultValue="BAHAN">
                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </AdminSelect>
                    </div>
                    <div className="grid gap-1">
                      <Label>Satuan Dasar</Label>
                      <Input name="baseUnit" placeholder="gr / ml / pcs" className="w-28" />
                    </div>
                    <div className="grid gap-1">
                      <Label>Batas Stok Min</Label>
                      <DecimalInput name="lowStockAlert" placeholder="—" className="w-28" />
                    </div>
                    <div className="grid gap-1 flex-1 min-w-40">
                      <Label>Catatan</Label>
                      <Input name="notes" placeholder="Opsional" />
                    </div>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      disabled={rowKeys.length === 1}
                      onClick={() => setRowKeys((ks) => ks.filter((k) => k !== key))}
                      aria-label="Hapus baris"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setRowKeys((ks) => [...ks, nextKey.current++])}
                >
                  + Baris
                </Button>
                <Button type="submit" size="sm" disabled={isPending}>Simpan Semua</Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => { setShowAdd(false); resetRows(); }}
                >
                  Batal
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto -mx-3 px-3 scrollbar-hide pb-1">
        {CATEGORIES.map((cat) => {
          const count = cat === "SEMUA" ? data.length : data.filter((d) => d.category === cat).length;
          if (cat !== "SEMUA" && count === 0) return null;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat === "SEMUA" ? "Semua" : CATEGORY_LABELS[cat]} ({count})
            </button>
          );
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Belum ada bahan baku. Tambahkan bahan di atas.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((row) => (
            <IngredientRow key={row.id} row={row} onClick={() => router.push(`/admin/ingredients/${row.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function IngredientRow({ row, onClick }: { row: Row; onClick: () => void }) {
  const priceArrow = row.lastUnitCost !== null && row.averageUnitCost > 0
    ? row.lastUnitCost > row.averageUnitCost ? "↑" : row.lastUnitCost < row.averageUnitCost ? "↓" : null
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left"
    >
      <Card className={`transition-all duration-150 active:scale-[0.98] ${row.isLow ? "border-destructive/40" : ""} ${!row.isActive ? "opacity-60" : ""}`}>
        <CardContent className="py-3">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{row.name}</span>
                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                  {CATEGORY_LABELS[row.category] ?? row.category}
                </span>
                {!row.isActive && (
                  <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">Nonaktif</span>
                )}
                {row.isLow && (
                  <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-medium">
                    Hampir habis
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                <span className="text-xs text-muted-foreground">
                  Stok:{" "}
                  <span className={`font-semibold tabular-nums ${row.isLow ? "text-destructive" : "text-foreground"}`}>
                    {row.currentStock % 1 === 0 ? row.currentStock.toFixed(0) : row.currentStock.toFixed(3)} {row.unit}
                  </span>
                  {row.lowStockAlert !== null && (
                    <span className="text-muted-foreground/60"> (min: {row.lowStockAlert})</span>
                  )}
                </span>
                {row.averageUnitCost > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    HPP avg: <span className="text-foreground font-medium">{formatRupiah(row.averageUnitCost)}/{row.unit}</span>
                  </span>
                )}
                {row.lastUnitCost !== null && row.lastUnitCost !== row.averageUnitCost && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Terakhir:{" "}
                    <span className={`font-medium ${priceArrow === "↑" ? "text-destructive" : priceArrow === "↓" ? "text-green-600 dark:text-green-400" : "text-foreground"}`}>
                      {priceArrow}{formatRupiah(row.lastUnitCost)}/{row.unit}
                    </span>
                  </span>
                )}
                {row.lastPurchasedAt && (
                  <span className="text-xs text-muted-foreground">
                    Beli: {formatDateTime(row.lastPurchasedAt)}
                  </span>
                )}
              </div>
            </div>

            <span className="text-muted-foreground/40 text-lg shrink-0">›</span>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}
