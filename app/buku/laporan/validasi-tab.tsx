"use client";

import { BentoCard, CardLabel, Row, Tag } from "@/components/shell/ui";
import { formatRupiah } from "@/lib/format";
import type { LaporanKeuangan } from "@/app/actions/admin/queries/laporan-keuangan-queries";

/** Checks whose name identifies the sales-vs-ledger cross-check — the one
 *  place a nonzero gap almost always means a day was never closed (kasir
 *  posts sales once per closed day at tutup kas, so an unclosed day leaves
 *  the ledger short of what the source transactions actually sold). */
function isSalesCrosscheck(name: string): boolean {
  return name.startsWith("Cross-check ev_sale");
}

/**
 * Validasi tab — reskin of app/admin/keuangan/laporan/_components/
 * validasi-tab.tsx (mockup 5), same pass/fail list and header badge (mockup
 * shows "✓ 12/12" — rendered here as "n/total lolos", reading the same
 * validasi.checks field). One copy fix carried across per
 * docs/redesign/plan-open-items.md section 1: the old file's hint below a
 * failing sales cross-check still points at "/admin/cash-register", a route
 * that no longer exists — this new tab says "/kas" instead. The old file
 * itself is left untouched.
 */
export function ValidasiTab({ laporan }: { laporan: LaporanKeuangan }) {
  const { validasi } = laporan;
  const passCount = validasi.checks.filter((c) => c.pass).length;

  return (
    <div className="flex flex-col gap-3">
      <Row title="Status Validasi">
        <Tag tone={validasi.all_pass ? "ok" : "bad"}>
          {validasi.all_pass ? `✓ ${passCount}/${validasi.checks.length}` : "Ada yang GAGAL"}
        </Tag>
      </Row>

      <BentoCard className="flex flex-col gap-3">
        <CardLabel>Pemeriksaan</CardLabel>
        {validasi.checks.map((c, i) => (
          <div key={`${c.name}-${i}`} className="flex flex-col gap-1 border-b border-border pb-3 last:border-0 last:pb-0">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[12.5px] font-semibold">{c.name}</span>
              <Tag tone={c.pass ? "ok" : "bad"}>{c.pass ? "OK" : "GAGAL"}</Tag>
            </div>
            <p className="text-[11.5px] font-semibold text-muted-foreground">{c.detail}</p>
            {!c.pass && isSalesCrosscheck(c.name) && (
              <p className="rounded-xl bg-warning-soft p-2.5 text-[11.5px] font-semibold text-warning-foreground">
                Selisih ini biasanya berarti ada hari yang belum ditutup kasnya — kasir mencatat
                penjualan ke buku besar hanya saat tutup kas, jadi hari yang belum ditutup tidak
                akan pernah masuk ke Laba Rugi meskipun transaksinya sudah ada. Cek /kas untuk hari
                yang belum ditutup.
              </p>
            )}
          </div>
        ))}
      </BentoCard>

      <BentoCard className="flex flex-col gap-0.5">
        <CardLabel>Ringkasan Selisih</CardLabel>
        <div className="flex items-center justify-between py-1.5 text-[12.5px] font-semibold">
          <span className="text-muted-foreground">Total Selisih Cross-check Penjualan</span>
          <span className="tabular-nums">{formatRupiah(validasi.sales_crosscheck.total_gap)}</span>
        </div>
        <div className="flex items-center justify-between py-1.5 text-[12.5px] font-semibold">
          <span className="text-muted-foreground">Total Drift (saldo vs assertion)</span>
          <span className="tabular-nums">{formatRupiah(validasi.drift_total)}</span>
        </div>
        <div className="flex items-center justify-between py-1.5 text-[12.5px] font-semibold">
          <span className="text-muted-foreground">Total Suspense (belum terklasifikasi)</span>
          <span className="tabular-nums">{formatRupiah(validasi.suspense_total)}</span>
        </div>
      </BentoCard>
    </div>
  );
}
