"use client";

import { useRef, useState } from "react";
import { Upload, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ErrorBanner } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { restoreDatabase, type BackupData } from "@/app/actions/admin/restore";
import { validateBackup } from "@/lib/backup-utils";

const TABLE_LABELS: Record<string, string> = {
  categories: "Kategori",
  menuItems: "Menu Item",
  menuVariants: "Varian Menu",
  packages: "Paket",
  packageItems: "Item Paket",
  menuItemOnlinePrices: "Harga Online",
  staff: "Staff",
  expenses: "Pengeluaran",
  expenseItems: "Item Pengeluaran",
  expenseTemplates: "Template Pengeluaran",
  tableSessions: "Sesi Meja",
  orderItems: "Item Order",
  transactions: "Transaksi",
  cashRegisters: "Kas Harian",
  recipes: "Resep",
  recipeIngredients: "Bahan Resep",
  kasPakHar: "Kas Pak Har",
  attendanceRecords: "Absensi",
  notifications: "Notifikasi",
  settings: "Pengaturan",
  onlineSettlements: "Pencairan Online",
  settlementItems: "Item Pencairan",
  settlementDeductions: "Potongan Pencairan",
};

export default function RestoreClient() {
  const fileRef = useRef<HTMLInputElement>(null);
  const { isPending, run, error } = useAdminAction();

  const [backup, setBackup] = useState<BackupData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ imported: Record<string, number>; errors: string[] } | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setBackup(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const validation = validateBackup(json);
        if (!validation.valid) {
          setParseError(validation.errors.join(", "));
          return;
        }
        setBackup(json as BackupData);
        setAvailableTables(validation.tables);
        setCounts(validation.counts);
        setSelected(new Set(validation.tables));
      } catch {
        setParseError("File bukan JSON yang valid");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function toggleTable(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleRestore() {
    if (!backup || selected.size === 0) return;
    run(
      async () => {
        const res = await restoreDatabase(backup, Array.from(selected));
        setResult(res);
      },
      { successMessage: undefined },
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload File Backup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFile}
          />
          <Button
            variant="outline"
            className="w-full"
            onClick={() => fileRef.current?.click()}
            disabled={isPending}
          >
            <Upload className="size-4" />
            Pilih File Backup (.json)
          </Button>
          {parseError && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertTriangle className="size-4 shrink-0" />
              {parseError}
            </p>
          )}
        </CardContent>
      </Card>

      {backup && (
        <>
          {backup.exportedAt && (
            <p className="text-xs text-muted-foreground">
              Dibuat: {new Date(backup.exportedAt).toLocaleString("id-ID")}
              {backup.version ? ` · v${backup.version}` : ""}
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Pilih Tabel yang Akan Dipulihkan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(availableTables))}>
                  Pilih Semua
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  Hapus Semua
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {availableTables.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(t)}
                      onChange={() => toggleTable(t)}
                      className="rounded"
                    />
                    <span className="flex-1">{TABLE_LABELS[t] ?? t}</span>
                    <span className="text-xs text-muted-foreground">{counts[t]}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 p-3 flex gap-2 text-sm">
            <AlertTriangle className="size-4 shrink-0 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <p className="text-yellow-800 dark:text-yellow-300">
              Data yang sudah ada dengan ID sama akan ditimpa. Data yang tidak ada di file backup akan tetap dipertahankan.
            </p>
          </div>

          <ErrorBanner error={error} />

          <Button
            className="w-full"
            onClick={handleRestore}
            disabled={isPending || selected.size === 0}
          >
            {isPending ? (
              <><Spinner /> Memulihkan...</>
            ) : (
              `Pulihkan Data (${selected.size} tabel)`
            )}
          </Button>
        </>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-primary" />
              Hasil Pemulihan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              {Object.entries(result.imported).map(([t, n]) => (
                <div key={t} className="flex justify-between text-sm">
                  <span>{TABLE_LABELS[t] ?? t}</span>
                  <span className="text-muted-foreground">{n} record</span>
                </div>
              ))}
            </div>
            {result.errors.length > 0 && (
              <div className="rounded-lg bg-destructive/10 p-3 space-y-1">
                <p className="text-sm font-medium text-destructive">Error ({result.errors.length})</p>
                {result.errors.slice(0, 10).map((e, i) => (
                  <p key={i} className="text-xs text-destructive/80">{e}</p>
                ))}
                {result.errors.length > 10 && (
                  <p className="text-xs text-destructive/60">...dan {result.errors.length - 10} lainnya</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
