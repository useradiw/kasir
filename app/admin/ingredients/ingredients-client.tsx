"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Settings2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import { AdminSelect, AdminPageHeader, ErrorBanner, UnitClassBadge } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { notify } from "@/lib/notify";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { addIngredientsBulk } from "@/app/actions/admin/ingredients";
import { DEFAULT_BASE_UNIT, type UnitClassName } from "@/lib/unit-class";
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

const UNIT_CLASSES: { value: UnitClassName; label: string; help: string }[] = [
  { value: "WEIGHT", label: "Berat", help: `dasar: ${DEFAULT_BASE_UNIT.WEIGHT}` },
  { value: "VOLUME", label: "Volume", help: `dasar: ${DEFAULT_BASE_UNIT.VOLUME}` },
  { value: "COUNT",  label: "Jumlah", help: `dasar: ${DEFAULT_BASE_UNIT.COUNT}` },
];

type SupplierLite = { id: string; name: string };

export default function IngredientsClient({
  data,
  suppliers,
  resolvedBaseUnits,
  isOwner,
}: {
  data: IngredientStockData;
  suppliers: SupplierLite[];
  resolvedBaseUnits: Record<UnitClassName, string>;
  isOwner: boolean;
}) {
  const router = useRouter();
  const { isPending, run, error, setError } = useAdminAction();
  const [showAdd, setShowAdd] = useState(false);
  const [rowKeys, setRowKeys] = useState<number[]>([0]);
  const nextKey = useRef(1);
  const [activeCategory, setActiveCategory] = useState<string>("SEMUA");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const lowCount = data.filter((d) => d.isLow && d.isActive).length;

  // Aggregate distinct tags for filter chips
  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const r of data) for (const t of r.tags ?? []) s.add(t);
    return [...s].sort();
  }, [data]);

  const filtered = useMemo(() => {
    let rows = activeCategory === "SEMUA" ? data : data.filter((d) => d.category === activeCategory);
    if (tagFilter) rows = rows.filter((d) => (d.tags ?? []).includes(tagFilter));
    return rows;
  }, [data, activeCategory, tagFilter]);

  function resetRows() {
    setRowKeys([0]);
    nextKey.current = 1;
  }

  function handleBulkAdd(fd: FormData) {
    const names      = fd.getAll("name").map(String);
    const categories = fd.getAll("category").map(String);
    const unitClasses = fd.getAll("unitClass").map(String);
    const lowStocks  = fd.getAll("lowStockAlert").map(String);
    const notesArr   = fd.getAll("notes").map(String);
    const supplierArr = fd.getAll("defaultSupplierId").map(String);
    const tagsArr    = fd.getAll("tags").map(String);

    const rows = names
      .map((name, i) => ({
        name:              name.trim(),
        category:          (categories[i] as Category) || "BAHAN",
        unitClass:         (unitClasses[i] as UnitClassName) || "COUNT",
        lowStockAlert:     lowStocks[i] ? parseFloat(lowStocks[i]) : null,
        notes:             notesArr[i]?.trim() || undefined,
        defaultSupplierId: supplierArr[i] || null,
        tags:              tagsArr[i] ? tagsArr[i].split(/[,;]\s*/).map((t) => t.trim()).filter(Boolean) : [],
      }))
      .filter((r) => r.name);

    if (rows.length === 0) { setError("Isi minimal satu nama bahan."); return; }

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
      <AdminPageHeader title="Daftar Bahan">
        <div className="flex items-center gap-2">
          {lowCount > 0 && (
            <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded-full font-medium">
              {lowCount} hampir habis
            </span>
          )}
          {isOwner && (
            <Button
              size="sm"
              variant="outline"
              render={<Link href="/admin/bahan/satuan" />}
              title="Satuan dasar per kelas (Berat/Volume/Jumlah)"
            >
              <Settings2 className="size-4" />
              <span className="hidden sm:inline">Satuan</span>
            </Button>
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
              <p className="text-xs text-muted-foreground">
                Pilih <strong>Kelas Satuan</strong> sekali per bahan. Satuan dasar otomatis ikut kelas
                ({UNIT_CLASSES.map((u) => `${u.label}→${resolvedBaseUnits[u.value]}`).join(", ")}).
              </p>
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
                      <Label>Kelas Satuan</Label>
                      <AdminSelect name="unitClass" defaultValue="COUNT">
                        {UNIT_CLASSES.map((u) => (
                          <option key={u.value} value={u.value}>{u.label} ({resolvedBaseUnits[u.value]})</option>
                        ))}
                      </AdminSelect>
                    </div>
                    <div className="grid gap-1">
                      <Label>Batas Stok Min</Label>
                      <DecimalInput name="lowStockAlert" placeholder="—" className="w-28" />
                    </div>
                    <div className="grid gap-1 w-44">
                      <Label>Supplier Default</Label>
                      <AdminSelect name="defaultSupplierId" defaultValue="">
                        <option value="">— Tidak ada —</option>
                        {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </AdminSelect>
                    </div>
                    <div className="grid gap-1 flex-1 min-w-40">
                      <Label>Tag (pisah koma)</Label>
                      <Input name="tags" placeholder="kering, basah, frozen…" />
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

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex gap-2 overflow-x-auto -mx-3 px-3 scrollbar-hide pb-1">
          <button
            onClick={() => setTagFilter(null)}
            className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
              tagFilter === null ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            semua tag
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                tagFilter === tag ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

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
            <IngredientRow
              key={row.id}
              row={row}
              resolvedBaseUnits={resolvedBaseUnits}
              onClick={() => router.push(`/admin/ingredients/${row.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function IngredientRow({
  row,
  resolvedBaseUnits,
  onClick,
}: {
  row: Row;
  resolvedBaseUnits: Record<UnitClassName, string>;
  onClick: () => void;
}) {
  const priceArrow = row.lastUnitCost !== null && row.averageUnitCost > 0
    ? row.lastUnitCost > row.averageUnitCost ? "↑" : row.lastUnitCost < row.averageUnitCost ? "↓" : null
    : null;

  const expectedBase = resolvedBaseUnits[row.unitClass as UnitClassName];
  const needsNormalize = expectedBase && row.unit !== expectedBase;

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
                <UnitClassBadge unitClass={row.unitClass} baseUnit={row.unit} />
                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                  {CATEGORY_LABELS[row.category] ?? row.category}
                </span>
                {row.hasRecipe && (
                  <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                    olahan
                  </span>
                )}
                {!row.isActive && (
                  <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">Nonaktif</span>
                )}
                {row.isLow && (
                  <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-medium">
                    Hampir habis
                  </span>
                )}
                {needsNormalize && (
                  <span className="text-[10px] bg-warning/10 text-warning-foreground px-1.5 py-0.5 rounded-full font-medium" title={`Disarankan ganti ke "${expectedBase}" agar konsisten`}>
                    perlu normalisasi → {expectedBase}
                  </span>
                )}
                {(row.tags ?? []).map((t) => (
                  <span key={t} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">#{t}</span>
                ))}
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
                {row.defaultSupplierName && (
                  <span className="text-xs text-muted-foreground">
                    Supplier: <span className="text-foreground">{row.defaultSupplierName}</span>
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
