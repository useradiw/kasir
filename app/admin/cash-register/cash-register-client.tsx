"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ErrorBanner } from "@/components/admin/ui";
import { DenominationInput } from "@/components/admin/denomination-input";
import { useAdminAction } from "@/hooks/use-admin-action";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { openRegister, closeRegister, editRegister, deleteRegister } from "@/app/actions/admin/cash-register";
import type { RoleEnum } from "@/generated/prisma";
import { Pencil } from "lucide-react";

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

function EditRegisterDialog({
  register,
  children,
}: {
  register: { id: string; date: string; openingCash: number; closingCash: number | null };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [openingAmount, setOpeningAmount] = useState(0);
  const [closingAmount, setClosingAmount] = useState(0);
  const { isPending, run, error } = useAdminAction();

  function handleOpenChange(next: boolean) {
    if (next) {
      setOpeningAmount(register.openingCash);
      setClosingAmount(register.closingCash ?? 0);
    }
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={children as React.ReactElement}>{}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Kas — {formatDateTime(register.date, "long")}</DialogTitle>
        </DialogHeader>
        <ErrorBanner error={error} />
        <form
          action={(fd) => run(async () => { await editRegister(register.id, fd); setOpen(false); })}
          className="space-y-4"
        >
          <div>
            <Label className="text-base">Kas Awal</Label>
            <DenominationInput value={openingAmount} onChange={setOpeningAmount} />
            <input type="hidden" name="openingCash" value={openingAmount} />
          </div>
          <div>
            <Label className="text-base">Kas Akhir</Label>
            <DenominationInput value={closingAmount} onChange={setClosingAmount} />
            <input type="hidden" name="closingCash" value={closingAmount} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function CashRegisterClient({
  staffRole,
  todayRegister,
  todayCashIncome,
  todayExpenses,
  todayExpectedClosing,
  registers,
  filters,
}: {
  staffRole: RoleEnum;
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
  const [openingAmount, setOpeningAmount] = useState(0);
  const [closingAmount, setClosingAmount] = useState(0);

  const isOwner = staffRole === "OWNER";

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
            isOwner ? (
              <form action={(fd) => run(() => openRegister(fd))} className="space-y-4">
                <Label className="text-base">Kas Awal</Label>
                <DenominationInput value={openingAmount} onChange={setOpeningAmount} />
                <input type="hidden" name="openingCash" value={openingAmount} />
                <Button type="submit" size="sm" disabled={isPending || openingAmount === 0}>Buka Kas</Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">Kas hari ini belum dibuka.</p>
            )
          ) : todayRegister.isOpen ? (
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
              {isOwner && (
                <>
                  <div className="flex justify-end">
                    <EditRegisterDialog register={todayRegister}>
                      <Button size="xs" variant="outline">
                        <Pencil className="size-3 mr-1" />
                        Edit
                      </Button>
                    </EditRegisterDialog>
                  </div>
                  <form action={(fd) => run(() => closeRegister(fd))} className="space-y-4 border-t pt-4">
                    <Label className="text-base">Kas Akhir</Label>
                    <DenominationInput value={closingAmount} onChange={setClosingAmount} />
                    <input type="hidden" name="closingCash" value={closingAmount} />
                    <Button type="submit" size="sm" disabled={isPending || closingAmount === 0}>Tutup Kas</Button>
                  </form>
                </>
              )}
            </div>
          ) : (
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
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Kas hari ini sudah ditutup.</p>
                {isOwner && (
                  <EditRegisterDialog register={todayRegister}>
                    <Button size="xs" variant="outline">
                      <Pencil className="size-3 mr-1" />
                      Edit
                    </Button>
                  </EditRegisterDialog>
                )}
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
                    </div>
                    {isOwner && (
                      <div className="flex gap-1 shrink-0">
                        <EditRegisterDialog register={r}>
                          <Button size="xs" variant="outline" disabled={isPending}>
                            <Pencil className="size-3" />
                          </Button>
                        </EditRegisterDialog>
                        <Button
                          size="xs"
                          variant="destructive"
                          disabled={isPending}
                          onClick={() => { if (confirm("Hapus data kas ini?")) run(() => deleteRegister(r.id)); }}
                        >
                          Hapus
                        </Button>
                      </div>
                    )}
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
