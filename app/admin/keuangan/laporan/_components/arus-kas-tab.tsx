"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LaporanKeuangan } from "@/app/actions/admin/queries/laporan-keuangan-queries";
import { StatementRow, EmptyBookNotice } from "./statement-row";

/**
 * Arus Kas (cash flow) tab. Setoran Modal / Setoran Saldo Awal / Pengambilan
 * Prive render as INDENTED SUB-ITEMS under Pendanaan, never under Operasi —
 * the engine (lib/accounting/cashFlow.ts) already classifies Equity:Prive
 * into the "pendanaan" bucket; this exact misplacement (Prive shown under
 * Operasi) shipped as a bug in tokokencana's sister app and was only caught
 * by looking at the rendered screen, not the engine. Do not move it.
 */
export function ArusKasTab({ laporan, isEmpty }: { laporan: LaporanKeuangan; isEmpty: boolean }) {
  const { arusKas } = laporan;

  return (
    <div className="space-y-4">
      {isEmpty && <EmptyBookNotice />}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Arus Kas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <StatementRow label="Kas dari Operasi" value={arusKas.operasi} emphasis />
          <StatementRow label="Kas dari Investasi" value={arusKas.investasi} emphasis />
          <StatementRow label="Kas dari Pendanaan" value={arusKas.pendanaan} emphasis />
          <StatementRow label="Setoran Modal" value={arusKas.setoran_modal} indent />
          <StatementRow label="Setoran Saldo Awal" value={arusKas.setoran_saldo_awal} indent />
          {/* Already cash-flow-sign-adjusted by the engine (negative = outflow) —
              do NOT negate again here, unlike perubahanModal.prive below. */}
          <StatementRow label="Pengambilan Prive" value={arusKas.pengambilan_prive} indent />

          <StatementRow label="Kas Awal" value={arusKas.kas_awal} divider />
          <StatementRow label="Kenaikan Kas Bersih" value={arusKas.kenaikan_kas_bersih} emphasis />
          <StatementRow label="Kas Akhir" value={arusKas.kas_akhir} divider emphasis large />
        </CardContent>
      </Card>
    </div>
  );
}
