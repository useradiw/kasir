"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminPageHeader, ErrorBanner } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { adjustIngredientStock, setLowStockAlert, getIngredientLogs } from "@/app/actions/admin/queries";
import type { IngredientStockData, IngredientLog } from "@/app/actions/admin/queries";
import { backfillIngredientStock } from "@/app/actions/admin/backfill-stock";
import { useConfirm } from "@/components/shared/confirm-dialog";

type Row = IngredientStockData[number];

export default function IngredientsClient({ data }: { data: IngredientStockData }) {
  const { isPending, run, error, setError } = useAdminAction();
  const confirm = useConfirm();

  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [alertId, setAlertId] = useState<string | null>(null);
  const [alertValue, setAlertValue] = useState("");
  const [logsId, setLogsId] = useState<string | null>(null);
  const [logs, setLogs] = useState<IngredientLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [backfillDone, setBackfillDone] = useState(false);

  const lowCount = data.filter((d) => d.isLow).length;

  async function handleAdjust(row: Row) {
    const qty = parseFloat(adjustQty);
    if (!adjustQty || isNaN(qty) || qty === 0) { setError("Jumlah penyesuaian tidak boleh 0."); return; }
    await run(
      () => adjustIngredientStock(row.id, qty, adjustNote),
      { successMessage: `Stok ${row.name} disesuaikan.` },
    );
    setAdjustId(null);
    setAdjustQty("");
    setAdjustNote("");
  }

  async function handleSetAlert(row: Row) {
    const val = alertValue.trim() === "" ? null : parseFloat(alertValue);
    await run(
      () => setLowStockAlert(row.id, val),
      { successMessage: `Batas stok minimum ${row.name} diperbarui.` },
    );
    setAlertId(null);
    setAlertValue("");
  }

  async function handleViewLogs(row: Row) {
    if (logsId === row.id) { setLogsId(null); return; }
    setLogsId(row.id);
    setLogsLoading(true);
    const result = await getIngredientLogs(row.id);
    setLogs(result);
    setLogsLoading(false);
  }

  async function handleBackfill() {
    if (
      !(await confirm({
        title: "Backfill stok dari riwayat pembelian?",
        description:
          "Ini akan mengisi ulang stok bahan dari semua data pengeluaran historis yang memiliki link template. Hanya jalankan sekali. Lanjutkan?",
        confirmLabel: "Jalankan Backfill",
      }))
    ) return;
    await run(async () => {
      await backfillIngredientStock();
      setBackfillDone(true);
    }, { successMessage: "Backfill stok berhasil dari riwayat pembelian." });
  }

  const typeLabel = (type: string) => {
    switch (type) {
      case "PURCHASE": return "Pembelian";
      case "SALE": return "Penjualan";
      case "ADJUSTMENT": return "Penyesuaian";
      case "WASTE": return "Pemborosan";
      default: return type;
    }
  };

  const typeColor = (type: string) => {
    switch (type) {
      case "PURCHASE": return "text-green-600 dark:text-green-400";
      case "SALE": return "text-destructive";
      case "ADJUSTMENT": return "text-yellow-600 dark:text-yellow-400";
      case "WASTE": return "text-orange-600 dark:text-orange-400";
      default: return "";
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Stok Bahan Baku">
        <div className="flex items-center gap-2">
          {lowCount > 0 && (
            <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded-full font-medium">
              {lowCount} bahan hampir habis
            </span>
          )}
          <Button size="sm" variant="outline" disabled={isPending || backfillDone} onClick={handleBackfill}>
            {backfillDone ? "Backfill selesai" : "Backfill dari riwayat"}
          </Button>
        </div>
      </AdminPageHeader>

      <ErrorBanner error={error} />

      {data.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Belum ada template bahan baku. Tambahkan di menu Template Pengeluaran.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.map((row) => (
            <Card key={row.id} className={row.isLow ? "border-destructive/40" : ""}>
              <CardContent className="py-3 space-y-2">
                {/* Main row */}
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{row.name}</span>
                      {!row.isActive && (
                        <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Nonaktif</span>
                      )}
                      {row.isLow && (
                        <span className="text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded font-medium">
                          ⚠ Hampir habis
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                      <span className="text-xs text-muted-foreground">
                        Stok: <span className={`font-semibold ${row.isLow ? "text-destructive" : "text-foreground"}`}>
                          {row.currentStock % 1 === 0 ? row.currentStock.toFixed(0) : row.currentStock.toFixed(2)} {row.unit ?? "unit"}
                        </span>
                        {row.lowStockAlert !== null && (
                          <span className="text-muted-foreground/70"> (min: {row.lowStockAlert})</span>
                        )}
                      </span>
                      {row.latestCost !== null && (
                        <span className="text-xs text-muted-foreground">
                          Harga terkini: <span className="font-medium text-foreground">{formatRupiah(row.latestCost)}/{row.unit ?? "unit"}</span>
                        </span>
                      )}
                      {row.lastPurchasedAt && (
                        <span className="text-xs text-muted-foreground">
                          Terakhir beli: {formatDateTime(row.lastPurchasedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                    <Button size="xs" variant="outline" onClick={() => { setAdjustId(adjustId === row.id ? null : row.id); setAdjustQty(""); setAdjustNote(""); }}>
                      Sesuaikan
                    </Button>
                    <Button size="xs" variant="outline" onClick={() => { setAlertId(alertId === row.id ? null : row.id); setAlertValue(row.lowStockAlert?.toString() ?? ""); }}>
                      Batas Min
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => handleViewLogs(row)}>
                      {logsId === row.id ? "Tutup Log" : "Log"}
                    </Button>
                  </div>
                </div>

                {/* Manual adjustment panel */}
                {adjustId === row.id && (
                  <div className="border border-foreground/10 rounded-lg p-3 space-y-3 bg-muted/30">
                    <p className="text-xs font-medium">Sesuaikan stok {row.name}</p>
                    <div className="flex flex-wrap gap-3 items-end">
                      <div className="grid gap-1 w-32">
                        <Label className="text-xs">Jumlah <span className="text-muted-foreground">(+ tambah / − kurangi)</span></Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="cth: 5 atau -2"
                          value={adjustQty}
                          onChange={(e) => setAdjustQty(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="grid gap-1 flex-1 min-w-32">
                        <Label className="text-xs">Catatan (opsional)</Label>
                        <Input
                          placeholder="cth: stok opname, pemborosan"
                          value={adjustNote}
                          onChange={(e) => setAdjustNote(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <Button size="sm" disabled={isPending} onClick={() => handleAdjust(row)}>Simpan</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAdjustId(null)}>Batal</Button>
                    </div>
                  </div>
                )}

                {/* Low stock alert panel */}
                {alertId === row.id && (
                  <div className="border border-foreground/10 rounded-lg p-3 space-y-3 bg-muted/30">
                    <p className="text-xs font-medium">Batas stok minimum {row.name}</p>
                    <div className="flex gap-3 items-end">
                      <div className="grid gap-1 w-32">
                        <Label className="text-xs">Jumlah minimum</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Kosong = nonaktif"
                          value={alertValue}
                          onChange={(e) => setAlertValue(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <Button size="sm" disabled={isPending} onClick={() => handleSetAlert(row)}>Simpan</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAlertId(null)}>Batal</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Kosongkan untuk menonaktifkan peringatan.</p>
                  </div>
                )}

                {/* Movement log */}
                {logsId === row.id && (
                  <div className="border border-foreground/10 rounded-lg overflow-hidden">
                    {logsLoading ? (
                      <p className="text-xs text-center py-3 text-muted-foreground">Memuat log...</p>
                    ) : logs.length === 0 ? (
                      <p className="text-xs text-center py-3 text-muted-foreground">Belum ada pergerakan stok.</p>
                    ) : (
                      <div className="divide-y divide-foreground/5">
                        <div className="grid grid-cols-[80px_60px_80px_1fr_120px] gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/30">
                          <span>Tipe</span>
                          <span className="text-right">Jumlah</span>
                          <span className="text-right">Harga/unit</span>
                          <span>Catatan</span>
                          <span className="text-right">Waktu</span>
                        </div>
                        {logs.map((log) => (
                          <div key={log.id} className="grid grid-cols-[80px_60px_80px_1fr_120px] gap-2 px-3 py-1.5 text-xs items-center">
                            <span className={`font-medium ${typeColor(log.type)}`}>{typeLabel(log.type)}</span>
                            <span className={`text-right font-medium ${log.quantity >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                              {log.quantity >= 0 ? "+" : ""}{log.quantity % 1 === 0 ? log.quantity.toFixed(0) : log.quantity.toFixed(2)}
                            </span>
                            <span className="text-right text-muted-foreground">{formatRupiah(log.unitCost)}</span>
                            <span className="text-muted-foreground truncate">{log.note ?? "—"}</span>
                            <span className="text-right text-muted-foreground">{formatDateTime(log.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
