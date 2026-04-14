"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBanner } from "@/components/admin/ui";
import { DenominationInput } from "@/components/admin/denomination-input";
import { useAdminAction } from "@/hooks/use-admin-action";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { openRegisterForStaff, closeRegisterForStaff } from "@/app/actions/cashregister";
import type { RoleEnum } from "@/generated/prisma";
import { ArrowLeft, Lock } from "lucide-react";

type TodayRegister = {
  id: string;
  date: string;
  openingCash: number;
  closingCash: number | null;
  isOpen: boolean;
  createdAt: string;
  openedByName: string | null;
  closedByName: string | null;
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
  openedByName: string | null;
  closedByName: string | null;
};

/** Reactive lock state — returns { locked, remaining } and auto-updates every second. */
function useLockState(createdAt: string | undefined, lockHours: number) {
  const calcRemaining = useCallback(() => {
    if (!createdAt) return { locked: false, remaining: "" };
    const lockExpiry = new Date(new Date(createdAt).getTime() + lockHours * 60 * 60 * 1000);
    const diff = lockExpiry.getTime() - Date.now();
    if (diff <= 0) return { locked: false, remaining: "" };
    const h = Math.floor(diff / (60 * 60 * 1000));
    const m = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    const s = Math.floor((diff % (60 * 1000)) / 1000);
    return { locked: true, remaining: `${h} jam ${m} menit ${s} detik` };
  }, [createdAt, lockHours]);

  const [state, setState] = useState(calcRemaining);

  useEffect(() => {
    setState(calcRemaining());
    const interval = setInterval(() => setState(calcRemaining()), 1000);
    return () => clearInterval(interval);
  }, [calcRemaining]);

  return state;
}

function LockCountdown({ remaining }: { remaining: string }) {
  if (!remaining) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm">
      <Lock className="size-4 text-muted-foreground shrink-0" />
      <div>
        <p className="font-medium">Kas terkunci</p>
        <p className="text-muted-foreground">
          Bisa ditutup dalam <span className="font-medium tabular-nums">{remaining}</span>
        </p>
      </div>
    </div>
  );
}

export default function CashRegisterStaffClient({
  staffRole,
  todayRegister,
  todayCashIncome,
  todayExpenses,
  todayExpectedClosing,
  lockHours,
  registers,
  filters,
}: {
  staffRole: RoleEnum;
  todayRegister: TodayRegister;
  todayCashIncome: number;
  todayExpenses: number;
  todayExpectedClosing: number;
  lockHours: number;
  registers: RegisterRow[];
  filters: { from: string; to: string };
}) {
  const router = useRouter();
  const { isPending, run, error } = useAdminAction();
  const [localFilters, setLocalFilters] = useState(filters);
  const [openingAmount, setOpeningAmount] = useState(0);
  const [closingAmount, setClosingAmount] = useState(0);

  const lockState = useLockState(
    todayRegister?.isOpen ? todayRegister.createdAt : undefined,
    lockHours,
  );
  const locked = lockState.locked;

  function applyFilters() {
    const params = new URLSearchParams();
    if (localFilters.from) params.set("from", localFilters.from);
    if (localFilters.to) params.set("to", localFilters.to);
    router.push(`/cashregister?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/kasir">
          <Button size="sm" variant="ghost">
            <ArrowLeft className="size-4 mr-1" />
            Kasir
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Kas Harian</h1>
      </div>

      <ErrorBanner error={error} />

      {/* Today's register */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Kas Hari Ini
            {todayRegister?.isOpen && locked && (
              <Lock className="size-4 text-muted-foreground" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayRegister === null ? (
            /* Not opened yet — show open form */
            <form action={(fd) => run(() => openRegisterForStaff(fd))} className="space-y-4">
              <Label className="text-base">Kas Awal</Label>
              <DenominationInput value={openingAmount} onChange={setOpeningAmount} />
              <input type="hidden" name="openingCash" value={openingAmount} />
              <Button type="submit" size="sm" disabled={isPending || openingAmount === 0}>
                Buka Kas
              </Button>
            </form>
          ) : todayRegister.isOpen ? (
            /* Opened — show info + lock or close form */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
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
              {todayRegister.openedByName && (
                <p className="text-xs text-muted-foreground">
                  Dibuka oleh: <span className="font-medium">{todayRegister.openedByName}</span>
                </p>
              )}

              {locked ? (
                <LockCountdown remaining={lockState.remaining} />
              ) : (
                <form action={(fd) => run(() => closeRegisterForStaff(fd))} className="space-y-4 border-t pt-4">
                  <Label className="text-base">Kas Akhir</Label>
                  <DenominationInput value={closingAmount} onChange={setClosingAmount} />
                  <input type="hidden" name="closingCash" value={closingAmount} />
                  <Button type="submit" size="sm" disabled={isPending || closingAmount === 0}>
                    Tutup Kas
                  </Button>
                </form>
              )}
            </div>
          ) : (
            /* Closed — show summary */
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
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
              <div className="flex flex-col gap-1">
                {todayRegister.openedByName && (
                  <p className="text-xs text-muted-foreground">
                    Dibuka oleh: <span className="font-medium">{todayRegister.openedByName}</span>
                  </p>
                )}
                {todayRegister.closedByName && (
                  <p className="text-xs text-muted-foreground">
                    Ditutup oleh: <span className="font-medium">{todayRegister.closedByName}</span>
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Kas hari ini sudah ditutup.</p>
              </div>
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
            <Button variant="ghost" size="sm" onClick={() => { setLocalFilters({ from: "", to: "" }); router.push("/cashregister"); }}>Reset</Button>
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
                  <p className="text-sm font-medium">{formatDateTime(r.date, "long")}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-1">
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
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {r.openedByName && <span>Dibuka: {r.openedByName}</span>}
                    {r.closedByName && <span>Ditutup: {r.closedByName}</span>}
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
