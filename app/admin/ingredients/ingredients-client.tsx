"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import { AdminSelect, AdminPageHeader, ErrorBanner } from "@/components/admin/ui";
import { Badge } from "@/components/shared/badge";
import { useAdminAction } from "@/hooks/use-admin-action";
import { notify } from "@/lib/notify";
import { formatRpPerUnit, formatDateTime } from "@/lib/format";
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

type SupplierLite = { id: string; name: string };

export default function IngredientsClient({
  data,
  suppliers,
}: {
  data: IngredientStockData;
  suppliers: SupplierLite[];
}) {
  const router = useRouter();
  const { isPending, run, error, setError } = useAdminAction();
  const [showAdd, setShowAdd] = useState(false);
  const [rowKeys, setRowKeys] = useState<number[]>([0]);
  const nextKey = useRef(1);
  const [activeCategory, setActiveCategory] = useState<string>("SEMUA");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const lowCount = data.filter((d) => d.isLow && d.isActive).length;

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
    const units      = fd.getAll("unit").map(String);
    const lowStocks  = fd.getAll("lowStockAlert").map(String);
    const notesArr   = fd.getAll("notes").map(String);
    const supplierArr = fd.getAll("defaultSupplierId").map(String);
    const tagsArr    = fd.getAll("tags").map(String);

    const rows = names
      .map((name, i) => ({
        name:              name.trim(),
        category:          (categories[i] as Category) || "BAHAN",
        unit:              units[i]?.trim() || "",
        lowStockAlert:     lowStocks[i] ? parseFloat(lowStocks[i]) : null,
        notes:             notesArr[i]?.trim() || undefined,
        defaultSupplierId: supplierArr[i] || null,
        tags:              tagsArr[i] ? tagsArr[i].split(/[,;]\s*/).map((t) => t.trim()).filter(Boolean) : [],
      }))
      .filter((r) => r.name);

    if (rows.length === 0) { setError("Isi minimal satu nama bahan."); return; }
    if (rows.some((r) => !r.unit)) { setError("Setiap bahan harus punya satuan."); return; }

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
            <Badge className="bg-destructive/10 text-destructive">
              {lowCount} hampir habis
            </Badge>
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
                Tentukan <strong>satuan</strong> tiap bahan (cth: <code>gram</code>, <code>ml</code>, <code>butir</code>, <code>pcs</code>).
                Satuan ini dipakai untuk stok, resep, dan HPP — konsisten di seluruh sistem.
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
                      <Label>Satuan</Label>
                      <Input name="unit" placeholder="cth: gram, butir" className="w-28" />
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
            <Button
              key={cat}
              variant={activeCategory === cat ? "default" : "secondary"}
              size="sm"
              onClick={() => setActiveCategory(cat)}
              className="shrink-0 h-7 text-xs"
            >
              {cat === "SEMUA" ? "Semua" : CATEGORY_LABELS[cat]} ({count})
            </Button>
          );
        })}
      </div>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex gap-2 overflow-x-auto -mx-3 px-3 scrollbar-hide pb-1">
          <Button
            variant={tagFilter === null ? "default" : "secondary"}
            size="sm"
            onClick={() => setTagFilter(null)}
            className="shrink-0 h-6 text-[11px] px-2"
          >
            semua tag
          </Button>
          {allTags.map((tag) => (
            <Button
              key={tag}
              variant={tagFilter === tag ? "default" : "secondary"}
              size="sm"
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              className="shrink-0 h-6 text-[11px] px-2"
            >
              #{tag}
            </Button>
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
  onClick,
}: {
  row: Row;
  onClick: () => void;
}) {
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
                <Badge className="text-[10px] bg-muted text-muted-foreground">{row.unit}</Badge>
                <Badge className="text-[10px] bg-muted text-muted-foreground">
                  {CATEGORY_LABELS[row.category] ?? row.category}
                </Badge>
                {row.hasRecipe && (
                  <Badge className="text-[10px] bg-primary/10 text-primary">
                    olahan
                  </Badge>
                )}
                {!row.isActive && (
                  <Badge className="text-[10px] bg-muted text-muted-foreground">Nonaktif</Badge>
                )}
                {row.isLow && (
                  <Badge className="text-[10px] bg-destructive/10 text-destructive">
                    Hampir habis
                  </Badge>
                )}
                {(row.tags ?? []).map((t) => (
                  <Badge key={t} className="text-[10px] bg-muted text-muted-foreground">#{t}</Badge>
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
                {row.unitCost > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    HPP: <span className="text-foreground font-medium">{formatRpPerUnit(row.unitCost)}/{row.unit}</span>
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

            <span className="text-muted-foreground/40 text-sm shrink-0">›</span>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}
