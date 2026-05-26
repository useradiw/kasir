"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import { AdminSelect, ErrorBanner, UnitClassBadge } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { formatRupiah, formatDateTime } from "@/lib/format";
import {
  updateIngredient,
  deactivateIngredient,
  addIngredientPack,
  updateIngredientPack,
  deleteIngredientPack,
  recordWasteAction,
  setIngredientCost,
  linkExpenseItemsToIngredient,
} from "@/app/actions/admin/ingredients";
import {
  upsertIngredientRecipe,
  deleteIngredientRecipe,
  addIngredientRecipeItem,
  addIngredientRecipeItemsBulk,
  updateIngredientRecipeItem,
  deleteIngredientRecipeItem,
  assembleIngredient,
} from "@/app/actions/admin/ingredient-recipes";
import { adjustIngredientStock } from "@/app/actions/admin/queries";
import type { UnitClassName } from "@/lib/unit-class";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import type {
  IngredientPurchaseHistory, IngredientLog,
  IngredientRecipeData, ActiveIngredientLite, UnlinkedExpenseItem,
} from "@/app/actions/admin/queries/ingredient-queries";

type Detail = {
  id: string;
  name: string;
  category: string;
  baseUnit: string;
  unitClass: "WEIGHT" | "VOLUME" | "COUNT";
  currentStock: number;
  averageUnitCost: number;
  lastUnitCost: number | null;
  lastPurchasedAt: Date | null;
  lowStockAlert: number | null;
  isActive: boolean;
  notes: string | null;
  defaultSupplierId: string | null;
  tags: string[];
  packs: { id: string; label: string; baseQty: number; isDefault: boolean }[];
};

type SupplierLite = { id: string; name: string };

const CATEGORY_LABELS: Record<string, string> = {
  BAHAN: "Bahan", KEMASAN: "Kemasan", PERLENGKAPAN: "Perlengkapan", LAINNYA: "Lainnya",
};

const LOG_TYPE_LABEL: Record<string, string> = {
  PURCHASE: "Pembelian", SALE: "Penjualan", ADJUSTMENT: "Penyesuaian", WASTE: "Pemborosan",
  ASSEMBLY: "Produksi",
};
const LOG_TYPE_COLOR: Record<string, string> = {
  PURCHASE: "text-green-600 dark:text-green-400",
  SALE:     "text-destructive",
  ADJUSTMENT: "text-yellow-600 dark:text-yellow-400",
  WASTE:    "text-orange-600 dark:text-orange-400",
  ASSEMBLY: "text-blue-600 dark:text-blue-400",
};

const SOURCE_LABEL: Record<string, string> = {
  EXPENSE: "Pengeluaran", ADJUSTMENT: "Penyesuaian", OPNAME_GAIN: "Opname",
  ASSEMBLY: "Produksi",
};

const TABS = [
  { key: "pembelian", label: "Pembelian" },
  { key: "pemakaian", label: "Pemakaian" },
  { key: "resep", label: "Resep" },
  { key: "pengaturan", label: "Pengaturan" },
];

export default function IngredientDetailClient({
  detail,
  purchases,
  logs,
  recipe,
  ingredientOptions,
  unlinkedItems,
  suppliers,
  resolvedBaseUnits,
  hasHistory,
  tab,
}: {
  detail: Detail;
  purchases: IngredientPurchaseHistory;
  logs: IngredientLog[];
  recipe: IngredientRecipeData;
  ingredientOptions: ActiveIngredientLite[];
  unlinkedItems: UnlinkedExpenseItem[];
  suppliers: SupplierLite[];
  resolvedBaseUnits: Record<UnitClassName, string>;
  hasHistory: boolean;
  tab: string;
}) {
  const router   = useRouter();
  const { isPending, run, error, setError } = useAdminAction();
  const confirm  = useConfirm();

  function switchTab(t: string) {
    setError(null);
    router.push(`/admin/ingredients/${detail.id}?tab=${t}`);
  }

  return (
    <div className="space-y-4">
      <Link
        href="/admin/ingredients"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Bahan Baku
      </Link>

      {/* Header card */}
      <Card>
        <CardContent className="py-4 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold">{detail.name}</h1>
                <UnitClassBadge unitClass={detail.unitClass} baseUnit={detail.baseUnit} />
                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                  {CATEGORY_LABELS[detail.category] ?? detail.category}
                </span>
                {!detail.isActive && (
                  <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full">Nonaktif</span>
                )}
                {detail.tags.map((t) => (
                  <span key={t} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">#{t}</span>
                ))}
              </div>
              {detail.notes && (
                <p className="text-xs text-muted-foreground mt-1">{detail.notes}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 pt-1">
            <div className="text-xs text-muted-foreground">
              Stok saat ini:{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {detail.currentStock % 1 === 0 ? detail.currentStock.toFixed(0) : detail.currentStock.toFixed(3)} {detail.baseUnit}
              </span>
              {detail.lowStockAlert !== null && (
                <span className="text-muted-foreground/60"> (min: {detail.lowStockAlert})</span>
              )}
            </div>
            {detail.averageUnitCost > 0 && (
              <div className="text-xs text-muted-foreground tabular-nums">
                HPP avg: <span className="font-semibold text-foreground">{formatRupiah(detail.averageUnitCost)}/{detail.baseUnit}</span>
              </div>
            )}
            {detail.lastUnitCost !== null && (
              <div className="text-xs text-muted-foreground tabular-nums">
                Harga terakhir: <span className="font-medium text-foreground">{formatRupiah(detail.lastUnitCost)}/{detail.baseUnit}</span>
              </div>
            )}
            {detail.lastPurchasedAt && (
              <div className="text-xs text-muted-foreground">
                Terakhir beli: {formatDateTime(detail.lastPurchasedAt)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ErrorBanner error={error} />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-foreground/10 -mx-3 px-3 overflow-x-auto scrollbar-hide">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Pembelian ── */}
      {tab === "pembelian" && (
        <div className="space-y-4">
          {/* Price history chart */}
          {purchases.length >= 2 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Riwayat HPP ({detail.baseUnit})</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={[...purchases].reverse().map((p) => ({
                    date:    formatDateTime(p.purchasedAt, "short"),
                    avgCost: p.avgUnitCostAfter,
                    unitCost: p.unitCost,
                  }))}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(v: unknown, name: unknown) => [
                        formatRupiah(v as number),
                        name === "avgCost" ? "HPP Avg" : "Harga Beli",
                      ]}
                    />
                    <Line type="monotone" dataKey="avgCost"  stroke="var(--primary)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="unitCost" stroke="var(--muted-foreground)" strokeWidth={1} dot={false} strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Purchase history */}
          <Card>
            <CardHeader><CardTitle>Riwayat Pembelian ({purchases.length})</CardTitle></CardHeader>
            <CardContent>
              {purchases.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Belum ada riwayat pembelian.</p>
              ) : (
                <div className="divide-y divide-foreground/5">
                  {(purchases as IngredientPurchaseHistory).map((p) => (
                    <div key={p.id} className="py-2.5 space-y-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium tabular-nums">{formatRupiah(p.totalCost)}</span>
                            <span className="text-xs text-muted-foreground">
                              {p.packQty}{p.packLabel ? ` ${p.packLabel}` : ""} × {formatRupiah(p.unitCost)}/{detail.baseUnit}
                            </span>
                            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                              {SOURCE_LABEL[p.source] ?? p.source}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(p.purchasedAt)}
                            {p.supplier?.name && <> · {p.supplier.name}</>}
                          </p>
                          {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
                        </div>
                        <div className="text-right shrink-0 text-xs text-muted-foreground tabular-nums">
                          <p>+{p.baseQty % 1 === 0 ? p.baseQty.toFixed(0) : p.baseQty.toFixed(3)} {detail.baseUnit}</p>
                          <p>HPP avg → {formatRupiah(p.avgUnitCostAfter)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── TAB: Pemakaian ── */}
      {tab === "pemakaian" && (
        <Card>
          <CardHeader><CardTitle>Log Pergerakan Stok</CardTitle></CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada pergerakan stok.</p>
            ) : (
              <div className="divide-y divide-foreground/5">
                {logs.map((log) => (
                  <div key={log.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <span className={`font-medium ${LOG_TYPE_COLOR[log.type] ?? ""}`}>
                        {LOG_TYPE_LABEL[log.type] ?? log.type}
                      </span>
                      {log.note && <span className="text-muted-foreground"> · {log.note}</span>}
                    </div>
                    <div className="text-right shrink-0 tabular-nums space-y-0.5">
                      <p className={`font-medium ${log.quantity >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                        {log.quantity >= 0 ? "+" : ""}{log.quantity % 1 === 0 ? log.quantity.toFixed(0) : log.quantity.toFixed(3)} {detail.baseUnit}
                      </p>
                      <p className="text-muted-foreground">{formatRupiah(log.unitCost)}/{detail.baseUnit}</p>
                      <p className="text-muted-foreground">{formatDateTime(log.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── TAB: Resep ── */}
      {tab === "resep" && (
        <RecipeTab
          detail={detail}
          recipe={recipe}
          ingredientOptions={ingredientOptions}
          isPending={isPending}
          run={run}
          confirm={confirm}
        />
      )}

      {/* ── TAB: Pengaturan ── */}
      {tab === "pengaturan" && (
        <SettingsTab
          detail={detail}
          suppliers={suppliers}
          resolvedBaseUnits={resolvedBaseUnits}
          hasHistory={hasHistory}
          unlinkedItems={unlinkedItems}
          isPending={isPending}
          run={run}
          confirm={confirm}
        />
      )}
    </div>
  );
}

function SettingsTab({
  detail,
  suppliers,
  resolvedBaseUnits,
  hasHistory,
  unlinkedItems,
  isPending,
  run,
  confirm,
}: {
  detail: Detail;
  suppliers: SupplierLite[];
  resolvedBaseUnits: Record<UnitClassName, string>;
  hasHistory: boolean;
  unlinkedItems: UnlinkedExpenseItem[];
  isPending: boolean;
  run: ReturnType<typeof useAdminAction>["run"];
  confirm: ReturnType<typeof useConfirm>;
}) {
  const router = useRouter();
  const [editPack, setEditPack] = useState<string | null>(null);
  const [showAddPack, setShowAddPack] = useState(false);
  const [showWaste, setShowWaste] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustQty, setAdjustQty] = useState<number | null>(null);
  const [adjustNote, setAdjustNote] = useState("");
  const [showCost, setShowCost] = useState(false);
  const [costValue, setCostValue] = useState<number | null>(null);
  const [costNote, setCostNote] = useState("");

  async function handleAdjust() {
    const qty = adjustQty;
    if (qty === null || qty === 0) return;
    await run(
      () => adjustIngredientStock(detail.id, qty, adjustNote),
      { successMessage: "Stok disesuaikan", onSuccess: () => { setShowAdjust(false); setAdjustQty(null); setAdjustNote(""); } },
    );
  }

  async function handleSetCost() {
    if (costValue === null || costValue < 0) return;
    await run(
      () => setIngredientCost(detail.id, costValue, costNote),
      { successMessage: "HPP diperbarui", onSuccess: () => { setShowCost(false); setCostValue(null); setCostNote(""); } },
    );
  }

  return (
    <div className="space-y-4">
      {/* Edit info */}
      <Card>
        <CardHeader><CardTitle>Info Bahan</CardTitle></CardHeader>
        <CardContent>
          <form
            action={(fd) => run(
              () => updateIngredient(detail.id, {
                name:              fd.get("name") as string,
                category:          (fd.get("category") as "BAHAN" | "KEMASAN" | "PERLENGKAPAN" | "LAINNYA"),
                unitClass:         (fd.get("unitClass") as UnitClassName) || detail.unitClass,
                lowStockAlert:     fd.get("lowStockAlert") ? parseFloat(fd.get("lowStockAlert") as string) : null,
                notes:             fd.get("notes") as string || undefined,
                defaultSupplierId: (fd.get("defaultSupplierId") as string) || null,
                tags:              (fd.get("tags") as string || "").split(/[,;]\s*/).map((t) => t.trim()).filter(Boolean),
              }),
              { successMessage: "Bahan diperbarui" },
            )}
            className="space-y-3"
          >
            <div className="flex flex-wrap gap-3 items-end">
              <div className="grid gap-1">
                <Label>Nama</Label>
                <Input name="name" defaultValue={detail.name} required className="w-44" />
              </div>
              <div className="grid gap-1">
                <Label>Kategori</Label>
                <AdminSelect name="category" defaultValue={detail.category}>
                  {Object.entries({ BAHAN: "Bahan", KEMASAN: "Kemasan", PERLENGKAPAN: "Perlengkapan", LAINNYA: "Lainnya" }).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </AdminSelect>
              </div>
              <div className="grid gap-1">
                <Label>Kelas Satuan</Label>
                <AdminSelect name="unitClass" defaultValue={detail.unitClass} disabled={hasHistory}>
                  <option value="WEIGHT">Berat ({resolvedBaseUnits.WEIGHT})</option>
                  <option value="VOLUME">Volume ({resolvedBaseUnits.VOLUME})</option>
                  <option value="COUNT">Jumlah ({resolvedBaseUnits.COUNT})</option>
                </AdminSelect>
                {hasHistory && (
                  <span className="text-[10px] text-muted-foreground">terkunci — sudah ada riwayat</span>
                )}
              </div>
              <div className="grid gap-1">
                <Label>Satuan Dasar (terkunci)</Label>
                <Input
                  value={detail.baseUnit}
                  readOnly
                  disabled
                  className="w-28 bg-muted/40 cursor-not-allowed"
                  title="Ditentukan otomatis dari Kelas Satuan. Ubah di Pengaturan → Satuan & Konversi."
                />
              </div>
              <div className="grid gap-1">
                <Label>Batas Min</Label>
                <DecimalInput name="lowStockAlert" defaultValue={detail.lowStockAlert} className="w-28" placeholder="—" />
              </div>
              <div className="grid gap-1 w-44">
                <Label>Supplier Default</Label>
                <AdminSelect name="defaultSupplierId" defaultValue={detail.defaultSupplierId ?? ""}>
                  <option value="">— Tidak ada —</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </AdminSelect>
              </div>
              <div className="grid gap-1 flex-1 min-w-40">
                <Label>Tag (pisah koma)</Label>
                <Input name="tags" defaultValue={detail.tags.join(", ")} placeholder="kering, basah, frozen…" />
              </div>
              <div className="grid gap-1 flex-1 min-w-40">
                <Label>Catatan</Label>
                <Input name="notes" defaultValue={detail.notes ?? ""} placeholder="Opsional" />
              </div>
            </div>
            <Button type="submit" size="sm" disabled={isPending}>Simpan Perubahan</Button>
          </form>
        </CardContent>
      </Card>

      {/* Packs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Satuan Pack</CardTitle>
          <Button size="sm" onClick={() => setShowAddPack((v) => !v)}>
            {showAddPack ? "Batal" : "+ Tambah Pack"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {showAddPack && (
            <form
              action={(fd) => run(
                () => addIngredientPack(detail.id, {
                  label:     fd.get("label") as string,
                  baseQty:   parseFloat(fd.get("baseQty") as string),
                  isDefault: fd.get("isDefault") === "true",
                }),
                { successMessage: "Pack ditambahkan", onSuccess: () => setShowAddPack(false) },
              )}
              className="flex flex-wrap gap-3 items-end border-b border-foreground/10 pb-3"
            >
              <div className="grid gap-1">
                <Label>Label</Label>
                <Input name="label" required placeholder="cth: dus, krat, kg" className="w-28" />
              </div>
              <div className="grid gap-1">
                <Label>Qty per Pack</Label>
                <DecimalInput name="baseQty" required placeholder={`dlm ${detail.baseUnit}`} className="w-28" />
              </div>
              <div className="grid gap-1">
                <Label>Default?</Label>
                <AdminSelect name="isDefault" defaultValue="false">
                  <option value="false">Tidak</option>
                  <option value="true">Ya</option>
                </AdminSelect>
              </div>
              <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
            </form>
          )}

          {detail.packs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada pack. Pack digunakan sebagai konversi satuan saat beli.</p>
          ) : (
            <div className="divide-y divide-foreground/5">
              {detail.packs.map((pack) => (
                <div key={pack.id} className="py-2">
                  {editPack === pack.id ? (
                    <form
                      action={(fd) => run(
                        () => updateIngredientPack(pack.id, {
                          label:     fd.get("label") as string,
                          baseQty:   parseFloat(fd.get("baseQty") as string),
                          isDefault: fd.get("isDefault") === "true",
                        }),
                        { successMessage: "Pack diperbarui", onSuccess: () => setEditPack(null) },
                      )}
                      className="flex flex-wrap gap-3 items-end"
                    >
                      <div className="grid gap-1">
                        <Label>Label</Label>
                        <Input name="label" defaultValue={pack.label} required className="w-28" />
                      </div>
                      <div className="grid gap-1">
                        <Label>Qty per Pack</Label>
                        <DecimalInput name="baseQty" defaultValue={pack.baseQty} required className="w-28" />
                      </div>
                      <div className="grid gap-1">
                        <Label>Default?</Label>
                        <AdminSelect name="isDefault" defaultValue={pack.isDefault ? "true" : "false"}>
                          <option value="false">Tidak</option>
                          <option value="true">Ya</option>
                        </AdminSelect>
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditPack(null)}>Batal</Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm">
                        <span className="font-medium">1 {pack.label}</span>
                        <span className="text-muted-foreground"> = {pack.baseQty} {detail.baseUnit}</span>
                        {pack.isDefault && <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Default</span>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="xs" variant="outline" onClick={() => setEditPack(pack.id)}>Edit</Button>
                        <Button size="xs" variant="destructive" disabled={isPending}
                          onClick={async () => {
                            if (await confirm({ title: `Hapus pack "${pack.label}"?`, destructive: true, confirmLabel: "Hapus" }))
                              run(() => deleteIngredientPack(pack.id), { successMessage: "Pack dihapus" });
                          }}>Hapus</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual adjustment */}
      <Card>
        <CardHeader><CardTitle>Penyesuaian Stok</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {showAdjust ? (
            <div className="flex flex-wrap gap-3 items-end">
              <div className="grid gap-1 w-36">
                <Label>Jumlah (+ tambah / − kurangi)</Label>
                <DecimalInput allowNegative placeholder="cth: 5 atau -2" defaultValue={adjustQty} onValueChange={setAdjustQty} className="h-8" />
              </div>
              <div className="grid gap-1 flex-1 min-w-36">
                <Label>Catatan</Label>
                <Input placeholder="Opsional" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} className="h-8" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={isPending} onClick={handleAdjust}>Simpan</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAdjust(false)}>Batal</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowAdjust(true)}>Sesuaikan Stok</Button>
          )}
        </CardContent>
      </Card>

      {/* Set HPP Manual */}
      <Card>
        <CardHeader><CardTitle>Set HPP Manual</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {showCost ? (
            <div className="flex flex-wrap gap-3 items-end">
              <div className="grid gap-1 w-36">
                <Label>HPP per {detail.baseUnit} (Rp)</Label>
                <DecimalInput placeholder="cth: 1500" defaultValue={costValue} onValueChange={setCostValue} className="h-8" />
              </div>
              <div className="grid gap-1 flex-1 min-w-36">
                <Label>Catatan</Label>
                <Input placeholder="Opsional" value={costNote} onChange={(e) => setCostNote(e.target.value)} className="h-8" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={isPending} onClick={handleSetCost}>Simpan</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowCost(false)}>Batal</Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Tetapkan HPP secara manual. Tercatat sebagai penyesuaian; pembelian dari pengeluaran berikutnya tetap menghitung rata-rata seperti biasa.
              </p>
              <Button size="sm" variant="outline" onClick={() => setShowCost(true)}>Set HPP Manual</Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Link past purchases */}
      <LinkPurchasesCard
        ingredientId={detail.id}
        items={unlinkedItems}
        isPending={isPending}
        run={run}
      />

      {/* Waste */}
      <Card>
        <CardHeader><CardTitle>Catat Pemborosan</CardTitle></CardHeader>
        <CardContent>
          {showWaste ? (
            <form
              action={(fd) => run(
                () => recordWasteAction(
                  detail.id,
                  parseFloat(fd.get("quantity") as string),
                  fd.get("reason") as string || undefined,
                ),
                { successMessage: "Pemborosan dicatat", onSuccess: () => setShowWaste(false) },
              )}
              className="flex flex-wrap gap-3 items-end"
            >
              <div className="grid gap-1 w-32">
                <Label>Jumlah ({detail.baseUnit})</Label>
                <DecimalInput name="quantity" required className="h-8" />
              </div>
              <div className="grid gap-1 flex-1 min-w-36">
                <Label>Alasan</Label>
                <Input name="reason" placeholder="cth: basi, tumpah" className="h-8" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isPending}>Catat</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowWaste(false)}>Batal</Button>
              </div>
            </form>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowWaste(true)}>+ Catat Pemborosan</Button>
          )}
        </CardContent>
      </Card>

      {/* Deactivate */}
      {detail.isActive && (
        <Card className="border-destructive/20">
          <CardHeader><CardTitle className="text-destructive text-sm">Zona Bahaya</CardTitle></CardHeader>
          <CardContent>
            <Button
              size="sm"
              variant="destructive"
              disabled={isPending}
              onClick={async () => {
                if (await confirm({ title: `Nonaktifkan ${detail.name}?`, description: "Bahan tidak akan muncul di form pengeluaran dan resep baru.", destructive: true, confirmLabel: "Nonaktifkan" }))
                  run(() => deactivateIngredient(detail.id), { successMessage: "Bahan dinonaktifkan", onSuccess: () => router.push("/admin/ingredients") });
              }}
            >
              Nonaktifkan Bahan
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LinkPurchasesCard({
  ingredientId,
  items,
  isPending,
  run,
}: {
  ingredientId: string;
  items: UnlinkedExpenseItem[];
  isPending: boolean;
  run: ReturnType<typeof useAdminAction>["run"];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  const filtered = filter.trim()
    ? items.filter((i) => i.description.toLowerCase().includes(filter.trim().toLowerCase()))
    : items;

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleLink() {
    if (selected.size === 0) return;
    run(
      async () => { await linkExpenseItemsToIngredient(ingredientId, [...selected]); },
      { successMessage: "Pembelian lama ditautkan", onSuccess: () => { setSelected(new Set()); setOpen(false); } },
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tautkan Pembelian Lama</CardTitle>
        <Button size="sm" onClick={() => setOpen((v) => !v)}>{open ? "Tutup" : "Buka"}</Button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada pembelian lama yang belum tertaut.</p>
          ) : (
            <>
              <Input
                placeholder="Cari deskripsi…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-8"
              />
              <div className="max-h-72 overflow-y-auto divide-y divide-foreground/5 border border-foreground/10 rounded-lg">
                {filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Tidak ada hasil.</p>
                ) : filtered.map((it) => (
                  <label key={it.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={selected.has(it.id)}
                      onChange={() => toggle(it.id)}
                      className="size-4 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{it.description}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {it.amount}{it.unit ? ` ${it.unit}` : ""} × {formatRupiah(it.cost)} · {formatDateTime(it.recordedAt)}
                      </p>
                    </div>
                    <span className="text-sm font-medium tabular-nums shrink-0">
                      {formatRupiah(Math.round(it.amount * it.cost))}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" disabled={isPending || selected.size === 0} onClick={handleLink}>
                  Tautkan{selected.size > 0 ? ` (${selected.size})` : ""}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Stok &amp; HPP bahan ini akan terisi dari pembelian terpilih.
                </span>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function RecipeTab({
  detail,
  recipe,
  ingredientOptions,
  isPending,
  run,
  confirm,
}: {
  detail: Detail;
  recipe: IngredientRecipeData;
  ingredientOptions: ActiveIngredientLite[];
  isPending: boolean;
  run: ReturnType<typeof useAdminAction>["run"];
  confirm: ReturnType<typeof useConfirm>;
}) {
  const [editItem, setEditItem] = useState<string | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);

  const components = ingredientOptions.filter((o) => o.id !== detail.id);
  const existingIngIds = useMemo(
    () => new Set(recipe?.items.map((it) => it.ingredientId) ?? []),
    [recipe],
  );

  if (!recipe) {
    return (
      <Card>
        <CardHeader><CardTitle>Resep Bahan</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Bahan ini belum punya resep. Buat resep bila bahan ini dirakit dari bahan lain (mis. saus kacang).
          </p>
          <form
            action={(fd) => run(
              async () => { await upsertIngredientRecipe(detail.id, {
                yieldQty: parseFloat(fd.get("yieldQty") as string),
                notes:    fd.get("notes") as string || undefined,
              }); },
              { successMessage: "Resep dibuat" },
            )}
            className="flex flex-wrap gap-3 items-end"
          >
            <div className="grid gap-1">
              <Label>Hasil / Batch ({detail.baseUnit})</Label>
              <DecimalInput name="yieldQty" required defaultValue={1} className="w-32" />
            </div>
            <div className="grid gap-1 flex-1 min-w-40">
              <Label>Catatan</Label>
              <Input name="notes" placeholder="Opsional" />
            </div>
            <Button type="submit" size="sm" disabled={isPending}>Buat Resep</Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  const totalCost  = recipe.items.reduce((s, it) => s + it.quantity * it.averageUnitCost, 0);
  const estPerUnit = recipe.yieldQty > 0 ? Math.round(totalCost / recipe.yieldQty) : 0;

  return (
    <div className="space-y-4">
      {/* Recipe header / yield */}
      <Card>
        <CardHeader><CardTitle>Resep Bahan</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <form
            action={(fd) => run(
              async () => { await upsertIngredientRecipe(detail.id, {
                yieldQty: parseFloat(fd.get("yieldQty") as string),
                notes:    fd.get("notes") as string || undefined,
              }); },
              { successMessage: "Resep diperbarui" },
            )}
            className="flex flex-wrap gap-3 items-end"
          >
            <div className="grid gap-1">
              <Label>Hasil / Batch ({detail.baseUnit})</Label>
              <DecimalInput name="yieldQty" required defaultValue={recipe.yieldQty} className="w-32" />
            </div>
            <div className="grid gap-1 flex-1 min-w-40">
              <Label>Catatan</Label>
              <Input name="notes" defaultValue={recipe.notes ?? ""} placeholder="Opsional" />
            </div>
            <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
          </form>
          <div className="text-xs text-muted-foreground tabular-nums">
            Estimasi HPP:{" "}
            <span className="font-semibold text-foreground">{formatRupiah(estPerUnit)}/{detail.baseUnit}</span>
            {" "}(total bahan {formatRupiah(Math.round(totalCost))} per {recipe.yieldQty} {detail.baseUnit})
          </div>
        </CardContent>
      </Card>

      {/* Components */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Komponen ({recipe.items.length})</CardTitle>
          <Button size="sm" onClick={() => setShowAddItem((v) => !v)}>
            {showAddItem ? "Batal" : "+ Komponen"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Bulk-add (textarea) */}
          <BulkAddComponentPanel
            recipeId={recipe.id}
            parentClass={detail.unitClass}
            existingIngIds={existingIngIds}
            components={components}
            isPending={isPending}
            run={run}
          />

          {showAddItem && (
            <form
              action={(fd) => run(
                () => addIngredientRecipeItem(recipe.id, {
                  ingredientId: fd.get("ingredientId") as string,
                  quantity:     parseFloat(fd.get("quantity") as string),
                }),
                { successMessage: "Komponen ditambahkan", onSuccess: () => setShowAddItem(false) },
              )}
              className="flex flex-wrap gap-3 items-end border-b border-foreground/10 pb-3"
            >
              <div className="grid gap-1">
                <Label>Bahan</Label>
                <AdminSelect name="ingredientId" required defaultValue="">
                  <option value="" disabled>Pilih bahan…</option>
                  {components.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.baseUnit}) [{c.unitClass}]
                      {c.unitClass !== detail.unitClass ? " ⚠ kelas beda" : ""}
                    </option>
                  ))}
                </AdminSelect>
              </div>
              <div className="grid gap-1">
                <Label>Jumlah / Batch</Label>
                <DecimalInput name="quantity" required className="w-28" />
              </div>
              <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
            </form>
          )}

          {recipe.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada komponen. Tambahkan bahan penyusun.</p>
          ) : (
            <div className="divide-y divide-foreground/5">
              {recipe.items.map((it) => (
                <div key={it.id} className="py-2">
                  {editItem === it.id ? (
                    <form
                      action={(fd) => run(
                        () => updateIngredientRecipeItem(it.id, parseFloat(fd.get("quantity") as string)),
                        { successMessage: "Komponen diperbarui", onSuccess: () => setEditItem(null) },
                      )}
                      className="flex flex-wrap gap-3 items-end"
                    >
                      <div className="text-sm font-medium pb-1.5">{it.ingredientName}</div>
                      <div className="grid gap-1">
                        <Label>Jumlah / Batch</Label>
                        <DecimalInput name="quantity" defaultValue={it.quantity} required className="w-28" />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditItem(null)}>Batal</Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{it.ingredientName}</span>
                          {it.ingredientClass !== detail.unitClass && (
                            <span className="text-[10px] bg-warning/10 text-warning-foreground px-1.5 py-0.5 rounded-full" title={`Komponen kelas ${it.ingredientClass}, induk kelas ${detail.unitClass}`}>
                              kelas beda ({it.ingredientClass})
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {it.quantity} {it.ingredientUnit} × {formatRupiah(it.averageUnitCost)} ={" "}
                          {formatRupiah(Math.round(it.quantity * it.averageUnitCost))}
                        </span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="xs" variant="outline" onClick={() => setEditItem(it.id)}>Edit</Button>
                        <Button size="xs" variant="destructive" disabled={isPending}
                          onClick={async () => {
                            if (await confirm({ title: `Hapus ${it.ingredientName}?`, destructive: true, confirmLabel: "Hapus" }))
                              run(() => deleteIngredientRecipeItem(it.id), { successMessage: "Komponen dihapus" });
                          }}>Hapus</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Produksi */}
      <Card>
        <CardHeader><CardTitle>Produksi</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {recipe.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tambahkan komponen dulu sebelum produksi.</p>
          ) : (
            <form
              action={(fd) => run(
                () => assembleIngredient(
                  detail.id,
                  parseFloat(fd.get("batches") as string),
                  (fd.get("date") as string) || undefined,
                ),
                { successMessage: "Produksi dicatat" },
              )}
              className="flex flex-wrap gap-3 items-end"
            >
              <div className="grid gap-1">
                <Label>Jumlah Batch</Label>
                <DecimalInput name="batches" required defaultValue={1} className="w-24" />
              </div>
              <div className="grid gap-1">
                <Label>Tanggal</Label>
                <Input type="date" name="date" className="w-40" />
              </div>
              <Button type="submit" size="sm" disabled={isPending}>Catat Produksi</Button>
            </form>
          )}
          <p className="text-xs text-muted-foreground">
            Produksi mengurangi stok komponen dan menambah stok {detail.name}, lalu memperbarui HPP-nya.
          </p>
        </CardContent>
      </Card>

      {/* Danger: delete recipe */}
      <Card className="border-destructive/20">
        <CardHeader><CardTitle className="text-destructive text-sm">Zona Bahaya</CardTitle></CardHeader>
        <CardContent>
          <Button size="sm" variant="destructive" disabled={isPending}
            onClick={async () => {
              if (await confirm({ title: "Hapus resep bahan ini?", description: "Komponen resep akan dihapus. Stok & HPP yang sudah tercatat tidak berubah.", destructive: true, confirmLabel: "Hapus" }))
                run(() => deleteIngredientRecipe(detail.id), { successMessage: "Resep dihapus" });
            }}>
            Hapus Resep
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Bulk-add components (for IngredientRecipe) ─────────────────────────────

type BulkCompRow =
  | { ok: true; ingredient: ActiveIngredientLite; quantity: number; raw: string; classWarn: boolean }
  | { ok: false; raw: string; reason: string };

function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function findComp(q: string, opts: ActiveIngredientLite[]): ActiveIngredientLite | null {
  const n = normName(q);
  if (!n) return null;
  return (
    opts.find((o) => normName(o.name) === n) ??
    opts.find((o) => normName(o.name).startsWith(n)) ??
    opts.find((o) => normName(o.name).includes(n) || n.includes(normName(o.name))) ??
    null
  );
}

function parseBulkComps(
  text: string,
  opts: ActiveIngredientLite[],
  existing: Set<string>,
  parentClass: "WEIGHT" | "VOLUME" | "COUNT",
): BulkCompRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.map((raw): BulkCompRow => {
    const m = raw.match(/^(.+?)[\s,;=\t]+([0-9]+(?:[.,][0-9]+)?)\s*([a-zA-Z]*)$/);
    if (!m) return { ok: false, raw, reason: "Format: nama, jumlah" };
    const name = m[1].trim();
    const qty = Number(m[2].replace(",", "."));
    if (!Number.isFinite(qty) || qty <= 0) return { ok: false, raw, reason: "Jumlah > 0" };
    const ing = findComp(name, opts);
    if (!ing) return { ok: false, raw, reason: `"${name}" tidak ditemukan` };
    if (existing.has(ing.id)) return { ok: false, raw, reason: `"${ing.name}" sudah ada` };
    return {
      ok: true,
      ingredient: ing,
      quantity: qty,
      raw,
      classWarn: ing.unitClass !== parentClass,
    };
  });
}

function BulkAddComponentPanel({
  recipeId,
  parentClass,
  existingIngIds,
  components,
  isPending,
  run,
}: {
  recipeId:       string;
  parentClass:    "WEIGHT" | "VOLUME" | "COUNT";
  existingIngIds: Set<string>;
  components:     ActiveIngredientLite[];
  isPending:      boolean;
  run:            ReturnType<typeof useAdminAction>["run"];
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const parsed = useMemo(
    () => (text.trim() ? parseBulkComps(text, components, existingIngIds, parentClass) : []),
    [text, components, existingIngIds, parentClass],
  );
  const okRows = parsed.filter((r): r is Extract<BulkCompRow, { ok: true }> => r.ok);
  const badRows = parsed.filter((r): r is Extract<BulkCompRow, { ok: false }> => !r.ok);
  const canSave = okRows.length > 0 && badRows.length === 0 && !isPending;

  return (
    <div className="border border-foreground/10 rounded-lg">
      <button
        type="button"
        className="w-full text-left px-3 py-2 text-sm font-medium hover:bg-muted/50"
        onClick={() => setOpen((s) => !s)}
      >
        {open ? "▼" : "▶"} Tambah banyak komponen sekaligus
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Satu komponen per baris. Format: <code className="bg-muted px-1 rounded">nama bahan, jumlah</code>.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="cth: Kacang Tanah, 500"
            className="w-full text-sm font-mono rounded-md border border-input bg-input/30 p-2"
          />

          {parsed.length > 0 && (
            <ul className="divide-y divide-foreground/10 text-sm border border-foreground/10 rounded">
              {parsed.map((r, idx) => (
                <li key={idx} className={`px-2 py-1 flex items-center gap-2 ${r.ok ? "" : "bg-destructive/5"}`}>
                  {r.ok ? (
                    <>
                      <span className="font-medium flex-1">{r.ingredient.name}</span>
                      <UnitClassBadge unitClass={r.ingredient.unitClass} />
                      {r.classWarn && (
                        <span className="text-[10px] bg-warning/10 text-warning-foreground px-1.5 py-0.5 rounded-full">kelas beda</span>
                      )}
                      <span className="text-sm tabular-nums">{r.quantity} {r.ingredient.baseUnit}</span>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 truncate">{r.raw}</span>
                      <span className="text-xs text-destructive">{r.reason}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!canSave}
              onClick={() => run(async () => {
                await addIngredientRecipeItemsBulk(recipeId, okRows.map((r) => ({
                  ingredientId: r.ingredient.id,
                  quantity:     r.quantity,
                })));
                setText("");
                setOpen(false);
              }, { successMessage: `${okRows.length} komponen ditambahkan.` })}
            >
              Simpan {okRows.length > 0 ? `(${okRows.length})` : ""}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setText(""); setOpen(false); }}>Batal</Button>
          </div>
        </div>
      )}
    </div>
  );
}
