"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBanner } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { openRegister, closeRegister, deleteRegister } from "@/app/actions/admin/cash-register";

type TodayRegister = {
  id: string;
  date: string;
  openingCash: number;
  closingCash: number | null;
  isOpen: boolean;
} | null;

type RegisterRow = {
  id: string;
  date: string;
  openingCash: number;
  closingCash: number | null;
  cashIncome: number;
  totalExpenses: number;
  expectedClosing: number;
  difference: number | null;
};

export default function CashRegisterClient({
  todayRegister,
  todayCashIncome,
  todayExpenses,
  todayExpectedClosing,
  registers,
  filters,
}: {
  todayRegister: TodayRegister;
  todayCashIncome: number;
  todayExpenses: number;
  todayExpectedClosing: number;
  registers: RegisterRow[];
  filters: { from: string; to: string };
}) {
  const router = useRouter();
  const { isPending, run, error } = useAdminAction();
  const [localFilters, setLocalFilters] = useState(filters);

  function applyFilters() {
    const params = new URLSearchParams();
    if (localFilters.from) params.set("from", localFilters.from);
    if (localFilters.to) params.set("to", localFilters.to);
    router.push(`/admin/cash-register?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Kas Harian</h1>

      <ErrorBanner error={error} />

      {/* Today's register */}
      <Card>
        <CardHeader>
          <CardTitle>Kas Hari Ini</CardTitle>
        </CardHeader>
        <CardContent>
          {todayRegister === null ? (
            <form action={(fd) => run(() => openRegister(fd))} className="flex flex-wrap gap-3 items-end">
              <div className="grid gap-1">
                <Label>Kas Awal (Rp)</Label>
                <Input name="openingCash" type="number" min={0} required placeholder="0" className="w-44" />
              </div>
              <Button type="submit" size="sm" disabled={isPending}>Buka Kas</Button>
            </form>
          ) : todayRegister.isOpen ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Kas Awal</p>
                  <p className="font-medium">{formatRupiah(todayRegister.openingCash)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pemasukan Tunai</p>
                  <p className="font-medium">{formatRupiah(todayCashIncome)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pengeluaran</p>
                  <p className="font-medium">{formatRupiah(todayExpenses)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Kas Diharapkan</p>
                  <p className="font-medium">{formatRupiah(todayExpectedClosing)}</p>
                </div>
              </div>
              <form action={(fd) => run(() => closeRegister(fd))} className="flex flex-wrap gap-3 items-end border-t pt-4">
                <div className="grid gap-1">
                  <Label>Kas Akhir (Rp)</Label>
                  <Input name="closingCash" type="number" min={0} required placeholder="0" className="w-44" />
                </div>
                <Button type="submit" size="sm" disabled={isPending}>Tutup Kas</Button>
              </form>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Kas Awal</p>
                  <p className="font-medium">{formatRupiah(todayRegister.openingCash)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pemasukan Tunai</p>
                  <p className="font-medium">{formatRupiah(todayCashIncome)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pengeluaran</p>
                  <p className="font-medium">{formatRupiah(todayExpenses)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Kas Akhir</p>
                  <p className="font-medium">{formatRupiah(todayRegister.closingCash ?? 0)}</p>
                </div>
              </div>
              <div className="text-sm border-t pt-2">
                <span className="text-muted-foreground">Selisih: </span>
                {(() => {
                  const diff = (todayRegister.closingCash ?? 0) - todayExpectedClosing;
                  return (
                    <span className={diff >= 0 ? "text-primary font-medium" : "text-destructive font-medium"}>
                      {diff >= 0 ? "+" : ""}{formatRupiah(diff)}
                    </span>
                  );
                })()}
              </div>
              <p className="text-xs text-muted-foreground">Kas hari ini sudah ditutup.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filter */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="grid gap-1">
              <Label>Dari</Label>
              <Input type="date" value={localFilters.from} onChange={(e) => setLocalFilters((f) => ({ ...f, from: e.target.value }))} className="w-36" />
            </div>
            <div className="grid gap-1">
              <Label>Sampai</Label>
              <Input type="date" value={localFilters.to} onChange={(e) => setLocalFilters((f) => ({ ...f, to: e.target.value }))} className="w-36" />
            </div>
            <Button onClick={applyFilters} size="sm">Filter</Button>
            <Button variant="ghost" size="sm" onClick={() => { setLocalFilters({ from: "", to: "" }); router.push("/admin/cash-register"); }}>Reset</Button>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader><CardTitle>Riwayat Kas ({registers.length})</CardTitle></CardHeader>
        <CardContent>
          {registers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Belum ada data kas.</p>
          ) : (
            <div className="divide-y divide-foreground/5">
              {registers.map((r) => (
                <div key={r.id} className="py-3 space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{formatDateTime(r.date, "long")}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-0.5 text-xs text-muted-foreground mt-1">
                        <span>Kas Awal: {formatRupiah(r.openingCash)}</span>
                        <span>Tunai Masuk: {formatRupiah(r.cashIncome)}</span>
                        <span>Pengeluaran: {formatRupiah(r.totalExpenses)}</span>
                        <span>Diharapkan: {formatRupiah(r.expectedClosing)}</span>
                        <span>
                          Kas Akhir: {r.closingCash !== null ? formatRupiah(r.closingCash) : <span className="italic">Belum ditutup</span>}
                        </span>
                        {r.difference !== null && (
                          <span className={r.difference >= 0 ? "text-primary" : "text-destructive"}>
                            Selisih: {r.difference >= 0 ? "+" : ""}{formatRupiah(r.difference)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="xs"
                      variant="destructive"
                      disabled={isPending}
                      className="shrink-0"
                      onClick={() => { if (confirm("Hapus data kas ini?")) run(() => deleteRegister(r.id)); }}
                    >
                      Hapus
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
