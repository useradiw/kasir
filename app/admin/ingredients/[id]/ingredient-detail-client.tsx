"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminSelect, ErrorBanner } from "@/components/admin/ui";
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
} from "@/app/actions/admin/ingredients";
import { adjustIngredientStock } from "@/app/actions/admin/queries";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import type { IngredientPurchaseHistory, IngredientLog } from "@/app/actions/admin/queries/ingredient-queries";

type Detail = {
  id: string;
  name: string;
  category: string;
  baseUnit: string;
  currentStock: number;
  averageUnitCost: number;
  lastUnitCost: number | null;
  lastPurchasedAt: Date | null;
  lowStockAlert: number | null;
  isActive: boolean;
  notes: string | null;
  packs: { id: string; label: string; baseQty: number; isDefault: boolean }[];
};

const CATEGORY_LABELS: Record<string, string> = {
  BAHAN: "Bahan", KEMASAN: "Kemasan", PERLENGKAPAN: "Perlengkapan", LAINNYA: "Lainnya",
};

const LOG_TYPE_LABEL: Record<string, string> = {
  PURCHASE: "Pembelian", SALE: "Penjualan", ADJUSTMENT: "Penyesuaian", WASTE: "Pemborosan",
};
const LOG_TYPE_COLOR: Record<string, string> = {
  PURCHASE: "text-green-600 dark:text-green-400",
  SALE:     "text-destructive",
  ADJUSTMENT: "text-yellow-600 dark:text-yellow-400",
  WASTE:    "text-orange-600 dark:text-orange-400",
};

const SOURCE_LABEL: Record<string, string> = {
  EXPENSE: "Pengeluaran", ADJUSTMENT: "Penyesuaian", OPNAME_GAIN: "Opname",
};

const TABS = [
  { key: "pembelian", label: "Pembelian" },
  { key: "pemakaian", label: "Pemakaian" },
  { key: "pengaturan", label: "Pengaturan" },
];

export default function IngredientDetailClient({
  detail,
  purchases,
  logs,
  tab,
}: {
  detail: Detail;
  purchases: IngredientPurchaseHistory;
  logs: IngredientLog[];
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
                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                  {CATEGORY_LABELS[detail.category] ?? detail.category}
                </span>
                {!detail.isActive && (
                  <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full">Nonaktif</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Satuan: {detail.baseUnit}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 pt-1">
            <div className="text-xs text-muted-foreground">
              Stok saat ini:{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {detail.currentStock % 1 === 0 ? detail.currentStock.toFixed(0) : detail.currentStock.toFixed(2)} {detail.baseUnit}
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
                          <p>+{p.baseQty % 1 === 0 ? p.baseQty.toFixed(0) : p.baseQty.toFixed(2)} {detail.baseUnit}</p>
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
                        {log.quantity >= 0 ? "+" : ""}{log.quantity % 1 === 0 ? log.quantity.toFixed(0) : log.quantity.toFixed(2)} {detail.baseUnit}
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

      {/* ── TAB: Pengaturan ── */}
      {tab === "pengaturan" && (
        <SettingsTab
          detail={detail}
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
  isPending,
  run,
  confirm,
}: {
  detail: Detail;
  isPending: boolean;
  run: ReturnType<typeof useAdminAction>["run"];
  confirm: ReturnType<typeof useConfirm>;
}) {
  const router = useRouter();
  const [editPack, setEditPack] = useState<string | null>(null);
  const [showAddPack, setShowAddPack] = useState(false);
  const [showWaste, setShowWaste] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustNote, setAdjustNote] = useState("");

  async function handleAdjust() {
    const qty = parseFloat(adjustQty);
    if (isNaN(qty) || qty === 0) return;
    await run(
      () => adjustIngredientStock(detail.id, qty, adjustNote),
      { successMessage: "Stok disesuaikan", onSuccess: () => { setShowAdjust(false); setAdjustQty(""); setAdjustNote(""); } },
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
                name:          fd.get("name") as string,
                category:      (fd.get("category") as "BAHAN" | "KEMASAN" | "PERLENGKAPAN" | "LAINNYA"),
                baseUnit:      fd.get("baseUnit") as string,
                lowStockAlert: fd.get("lowStockAlert") ? parseFloat(fd.get("lowStockAlert") as string) : null,
                notes:         fd.get("notes") as string || undefined,
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
                <Label>Satuan Dasar</Label>
                <Input name="baseUnit" defaultValue={detail.baseUnit} required className="w-28" />
              </div>
              <div className="grid gap-1">
                <Label>Batas Min</Label>
                <Input name="lowStockAlert" type="number" step="0.01" min="0" defaultValue={detail.lowStockAlert ?? ""} className="w-28" placeholder="—" />
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
                <Input name="baseQty" type="number" step="0.01" min="0.01" required placeholder={`dlm ${detail.baseUnit}`} className="w-28" />
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
                        <Input name="baseQty" type="number" step="0.01" min="0.01" defaultValue={pack.baseQty} required className="w-28" />
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
                <Input type="number" step="0.01" placeholder="cth: 5 atau -2" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} className="h-8" />
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
                <Input name="quantity" type="number" step="0.01" min="0.01" required className="h-8" />
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
