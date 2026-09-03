"use client";

import { useRef, useState } from "react";
import { Upload, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { BentoCard, CardLabel } from "@/components/shell/ui";
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
  suppliers: "Supplier",
  tableSessions: "Sesi Meja",
  orderItems: "Item Order",
  transactions: "Transaksi",
  cashRegisters: "Kas Harian",
  attendanceRecords: "Absensi",
  notifications: "Notifikasi",
  settings: "Pengaturan",
  onlineSettlements: "Pencairan Online",
  settlementItems: "Item Pencairan",
  settlementDeductions: "Potongan Pencairan",
  // --- Warung Books ledger. Keep in sync with TABLE_OPTIONS in
  // backup-client.tsx, ALL_TABLES in app/actions/admin/backup.ts AND
  // IMPORT_ORDER in app/actions/admin/restore.ts. ---
  ledgerAccounts: "Akun Buku Besar",
  expenseCategories: "Kategori Pengeluaran",
  sequences: "Nomor Urut Jurnal",
  accountingMonths: "Bulan Akuntansi",
  salesChannelAccounts: "Akun Kas Penjualan",
  accountingSettings: "Pengaturan Akuntansi",
  balanceAssertions: "Cek Saldo",
  journalEntries: "Jurnal",
  journalLines: "Baris Jurnal",
  ledgerPostings: "Tautan Jurnal",
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
    <>
      <BentoCard className="flex flex-col gap-3">
        <CardLabel>Upload File Backup</CardLabel>
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
          <p className="flex items-center gap-1 text-[12.5px] font-semibold text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            {parseError}
          </p>
        )}
      </BentoCard>

      {backup && (
        <>
          {backup.exportedAt && (
            <p className="text-[11.5px] font-semibold text-muted-foreground">
              Dibuat: {new Date(backup.exportedAt).toLocaleString("id-ID")}
              {backup.version ? ` · v${backup.version}` : ""}
            </p>
          )}

          <BentoCard className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardLabel>Pilih Tabel yang Akan Dipulihkan</CardLabel>
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(availableTables))}>
                  Pilih Semua
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  Hapus Semua
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {availableTables.map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold">
                  <input
                    type="checkbox"
                    checked={selected.has(t)}
                    onChange={() => toggleTable(t)}
                    className="rounded accent-primary"
                  />
                  <span className="flex-1">{TABLE_LABELS[t] ?? t}</span>
                  <span className="text-[11.5px] text-muted-foreground tabular-nums">{counts[t]}</span>
                </label>
              ))}
            </div>
          </BentoCard>

          <div className="flex gap-2 rounded-2xl border border-warning/35 bg-warning-soft p-3.5 text-[12.5px] font-semibold">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <p className="text-warning">
              Data yang sudah ada dengan ID sama akan ditimpa. Data yang tidak ada di file backup akan tetap dipertahankan.
            </p>
          </div>

          {error ? (
            <div className="rounded-2xl border border-destructive/35 bg-destructive-soft p-3.5 text-[12.5px] font-semibold text-destructive">
              {error}
            </div>
          ) : null}

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
        <BentoCard className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-primary" />
            <CardLabel>Hasil Pemulihan</CardLabel>
          </div>
          <div className="flex flex-col gap-1">
            {Object.entries(result.imported).map(([t, n]) => (
              <div key={t} className="flex justify-between text-[12.5px] font-semibold">
                <span>{TABLE_LABELS[t] ?? t}</span>
                <span className="text-muted-foreground tabular-nums">{n} record</span>
              </div>
            ))}
          </div>
          {result.errors.length > 0 && (
            <div className="flex flex-col gap-1 rounded-xl bg-destructive-soft p-3">
              <p className="text-[12.5px] font-bold text-destructive">Error ({result.errors.length})</p>
              {result.errors.slice(0, 10).map((e, i) => (
                <p key={i} className="text-[11px] text-destructive/80">{e}</p>
              ))}
              {result.errors.length > 10 && (
                <p className="text-[11px] text-destructive/60">...dan {result.errors.length - 10} lainnya</p>
              )}
            </div>
          )}
        </BentoCard>
      )}
    </>
  );
}
