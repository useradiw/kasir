"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/shared/badge";
import { formatRupiah } from "@/lib/format";
import type { LaporanKeuangan } from "@/app/actions/admin/queries/laporan-keuangan-queries";

/** Checks whose name identifies the sales-vs-ledger cross-check — the one
 *  place a nonzero gap almost always means a day was never closed (kasir
 *  posts sales once per closed day at tutup kas, so an unclosed day leaves
 *  the ledger short of what the source transactions actually sold). */
function isSalesCrosscheck(name: string): boolean {
  return name.startsWith("Cross-check ev_sale");
}

export function ValidasiTab({ laporan }: { laporan: LaporanKeuangan }) {
  const { validasi } = laporan;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border bg-card p-3">
        <span className="text-sm font-medium">Status Validasi</span>
        <Badge
          className={
            validasi.all_pass
              ? "bg-primary/10 text-primary"
              : "bg-destructive/10 text-destructive"
          }
        >
          {validasi.all_pass ? "Semua OK" : "Ada yang GAGAL"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pemeriksaan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {validasi.checks.map((c, i) => (
            <div key={`${c.name}-${i}`} className="space-y-1 border-b border-foreground/5 pb-3 last:border-0 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm">{c.name}</span>
                <Badge
                  className={
                    c.pass
                      ? "bg-primary/10 text-primary shrink-0"
                      : "bg-destructive/10 text-destructive shrink-0"
                  }
                >
                  {c.pass ? "OK" : "GAGAL"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{c.detail}</p>
              {!c.pass && isSalesCrosscheck(c.name) && (
                <p className="rounded-md bg-warning/10 p-2 text-xs text-warning-foreground">
                  Selisih ini biasanya berarti ada hari yang belum ditutup kasnya — kasir
                  mencatat penjualan ke buku besar hanya saat tutup kas, jadi hari yang belum
                  ditutup tidak akan pernah masuk ke Laba Rugi meskipun transaksinya sudah ada.
                  Cek /admin/cash-register untuk hari yang belum ditutup.
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Ringkasan Selisih</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <div className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-muted-foreground">Total Selisih Cross-check Penjualan</span>
            <span className="tabular-nums">{formatRupiah(validasi.sales_crosscheck.total_gap)}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-muted-foreground">Total Drift (saldo vs assertion)</span>
            <span className="tabular-nums">{formatRupiah(validasi.drift_total)}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-muted-foreground">Total Suspense (belum terklasifikasi)</span>
            <span className="tabular-nums">{formatRupiah(validasi.suspense_total)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
