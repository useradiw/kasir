"use client";

import { BentoCard, CardLabel } from "@/components/shell/ui";
import type { LaporanKeuangan } from "@/app/actions/admin/queries/laporan-keuangan-queries";
import { StatementRow, EmptyBookNotice } from "./statement-row";

/**
 * Laba Rugi tab — reskin of app/admin/keuangan/laporan/_components/
 * laba-rugi-tab.tsx (mockup 1). Every row, total and the drop-down to a
 * single Laba Bersih hero at the end carried across unchanged; only the
 * cards moved from shadcn Card to BentoCard.
 *
 * Row #10's "rows become drill-downs to jurnal entries" is NOT built here —
 * JurnalRow/LaporanKeuangan carry no link from a statement line back to the
 * journal entries that produced it, and writing that query is out of scope
 * for this rebuild (docs/redesign/plan-open-items.md section 1). Rows are
 * plain, non-tappable.
 */
export function LabaRugiTab({ laporan, isEmpty }: { laporan: LaporanKeuangan; isEmpty: boolean }) {
  const { labaRugi } = laporan;

  return (
    <div className="flex flex-col gap-3">
      {isEmpty && <EmptyBookNotice />}

      <BentoCard className="flex flex-col gap-0.5">
        <CardLabel>Pendapatan</CardLabel>
        <StatementRow label="Penjualan Tunai" value={labaRugi.pendapatan.tunai} indent />
        <StatementRow label="Penjualan QRIS" value={labaRugi.pendapatan.qris} indent />
        <StatementRow label="Penjualan Online" value={labaRugi.pendapatan.online} indent />
        <StatementRow label="Total Pendapatan" value={labaRugi.pendapatan.total} divider emphasis />
      </BentoCard>

      <BentoCard className="flex flex-col gap-0.5">
        <CardLabel>HPP</CardLabel>
        {labaRugi.hpp.lines.map((l) => (
          <StatementRow key={l.account} label={l.label} value={-l.amount} indent negative />
        ))}
        <StatementRow label="Total HPP" value={-labaRugi.hpp.total} negative divider />
        <StatementRow label="Laba Kotor" value={labaRugi.laba_kotor} divider emphasis />
      </BentoCard>

      <BentoCard className="flex flex-col gap-0.5">
        <CardLabel>Beban Operasional</CardLabel>
        {labaRugi.biaya_operasional.lines.map((l) => (
          <StatementRow key={l.account} label={l.label} value={-l.amount} indent negative />
        ))}
        <StatementRow label="Total Beban" value={-labaRugi.biaya_operasional.total} negative divider />
      </BentoCard>

      <BentoCard>
        <StatementRow label="Laba Bersih" value={labaRugi.laba_bersih} emphasis large />
      </BentoCard>
    </div>
  );
}
