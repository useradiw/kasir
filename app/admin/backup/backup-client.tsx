"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ErrorBanner } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { exportDatabase } from "@/app/actions/admin/backup";

const TABLE_OPTIONS = [
  { key: "categories", label: "Kategori" },
  { key: "menuItems", label: "Menu Item" },
  { key: "menuVariants", label: "Varian Menu" },
  { key: "packages", label: "Paket" },
  { key: "packageItems", label: "Item Paket" },
  { key: "staff", label: "Staff" },
  { key: "expenses", label: "Pengeluaran" },
  { key: "tableSessions", label: "Sesi Meja" },
  { key: "orderItems", label: "Item Order" },
  { key: "transactions", label: "Transaksi" },
  { key: "cashRegisters", label: "Kas Harian" },
  { key: "attendanceRecords", label: "Absensi" },
] as const;

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BackupClient() {
  const { isPending, run, error } = useAdminAction();
  const [selected, setSelected] = useState<Set<string>>(new Set(TABLE_OPTIONS.map((t) => t.key)));
  const [lastBackup, setLastBackup] = useState<string | null>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("lastBackupDate");
    return null;
  });

  function toggleTable(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(TABLE_OPTIONS.map((t) => t.key)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  function handleExport() {
    run(
      async () => {
        const data = await exportDatabase(Array.from(selected));
        const date = new Date().toISOString().slice(0, 10);
        downloadJson(data, `backup-${date}.json`);
        const now = new Date().toLocaleString("id-ID");
        localStorage.setItem("lastBackupDate", now);
        setLastBackup(now);
      },
      { successMessage: "Backup berhasil diunduh" },
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Backup Database</h1>

      <ErrorBanner error={error} />

      <Card>
        <CardHeader>
          <CardTitle>Pilih Tabel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Pilih Semua
            </Button>
            <Button variant="ghost" size="sm" onClick={deselectAll}>
              Hapus Semua
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {TABLE_OPTIONS.map((t) => (
              <label key={t.key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(t.key)}
                  onChange={() => toggleTable(t.key)}
                  className="rounded"
                />
                {t.label}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <Button
            onClick={handleExport}
            disabled={isPending || selected.size === 0}
            className="w-full"
          >
            {isPending ? (
              <>
                <Spinner />
                Mengekspor...
              </>
            ) : (
              <>
                <Download className="size-4" />
                Export Data ({selected.size} tabel)
              </>
            )}
          </Button>

          {lastBackup && (
            <p className="text-xs text-muted-foreground text-center">
              Backup terakhir: {lastBackup}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
