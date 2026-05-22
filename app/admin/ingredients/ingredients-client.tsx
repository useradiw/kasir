"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import { AdminSelect, AdminPageHeader, ErrorBanner } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { addIngredient } from "@/app/actions/admin/ingredients";
import type { IngredientStockData } from "@/app/actions/admin/queries";

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
  const [activeCategory, setActiveCategory] = useState<string>("SEMUA");

  const lowCount = data.filter((d) => d.isLow && d.isActive).length;

  const filtered = activeCategory === "SEMUA"
    ? data
    : data.filter((d) => d.category === activeCategory);

  async function handleAdd(fd: FormData) {
    const lowStockRaw = fd.get("lowStockAlert") as string;
    await run(
      async () => { await addIngredient({
        name:          fd.get("name") as string,
        category:      (fd.get("category") as "BAHAN" | "KEMASAN" | "PERLENGKAPAN" | "LAINNYA") ?? "BAHAN",
        baseUnit:      fd.get("baseUnit") as string,
        lowStockAlert: lowStockRaw ? parseFloat(lowStockRaw) : null,
        notes:         fd.get("notes") as string || undefined,
      }); },
      { successMessage: "Bahan berhasil ditambahkan", onSuccess: () => setShowAdd(false) },
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

      {/* Add form */}
      {showAdd && (
        <Card>
          <CardContent className="pt-4">
            <form action={handleAdd} className="space-y-3">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="grid gap-1">
                  <Label>Nama Bahan</Label>
                  <Input name="name" required placeholder="cth: Telur, Gula" className="w-44" />
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
                  <Input name="baseUnit" required placeholder="gr / ml / pcs" className="w-28" />
                </div>
                <div className="grid gap-1">
                  <Label>Batas Stok Min</Label>
                  <DecimalInput name="lowStockAlert" placeholder="—" className="w-28" />
                </div>
                <div className="grid gap-1 flex-1 min-w-40">
                  <Label>Catatan</Label>
                  <Input name="notes" placeholder="Opsional" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Batal</Button>
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
                    {row.currentStock % 1 === 0 ? row.currentStock.toFixed(0) : row.currentStock.toFixed(2)} {row.unit}
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
