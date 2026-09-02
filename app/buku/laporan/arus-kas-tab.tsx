"use client";

import { BentoCard, CardLabel } from "@/components/shell/ui";
import type { LaporanKeuangan } from "@/app/actions/admin/queries/laporan-keuangan-queries";
import { StatementRow, EmptyBookNotice } from "./statement-row";

/**
 * Arus Kas (cash flow) tab — reskin of app/admin/keuangan/laporan/
 * _components/arus-kas-tab.tsx (mockup 3). Setoran Modal / Setoran Saldo
 * Awal / Pengambilan Prive render as INDENTED SUB-ITEMS under Pendanaan,
 * never under Operasi — the engine (lib/accounting/cashFlow.ts) already
 * classifies Equity:Prive into the "pendanaan" bucket; this exact
 * misplacement (Prive shown under Operasi) shipped as a bug in
 * tokokencana's sister app and was only caught by looking at the rendered
 * screen, not the engine. Do not move it.
 *
 * Every figure here (operasi/investasi/pendanaan, kas_awal,
 * kenaikan_kas_bersih, kas_akhir) comes straight out of getLaporanKeuangan —
 * this component does not sum operasi+investasi+pendanaan itself to check
 * it equals kenaikan_kas_bersih, nor kas_awal+kenaikan_kas_bersih against
 * kas_akhir. Both ties are already asserted by the engine
 * (lib/accounting/cashFlow.ts, covered in test/statements.test.ts) and
 * re-derived again in test/buku-laporan.test.ts as a guard on the fixture
 * shape this screen relies on.
 */
export function ArusKasTab({ laporan, isEmpty }: { laporan: LaporanKeuangan; isEmpty: boolean }) {
  const { arusKas } = laporan;

  return (
    <div className="flex flex-col gap-3">
      {isEmpty && <EmptyBookNotice />}
      <BentoCard className="flex flex-col gap-0.5">
        <CardLabel>Arus Kas</CardLabel>
        <StatementRow label="Kas dari Operasi" value={arusKas.operasi} emphasis />
        <StatementRow label="Kas dari Investasi" value={arusKas.investasi} emphasis />
        <StatementRow label="Kas dari Pendanaan" value={arusKas.pendanaan} emphasis />
        <StatementRow label="Setoran Modal" value={arusKas.setoran_modal} indent />
        <StatementRow label="Setoran Saldo Awal" value={arusKas.setoran_saldo_awal} indent />
        {/* Already cash-flow-sign-adjusted by the engine (negative = outflow) —
            do NOT negate again here, unlike perubahanModal.prive in the Modal tab. */}
        <StatementRow label="Pengambilan Prive" value={arusKas.pengambilan_prive} indent />

        <StatementRow label="Kas Awal" value={arusKas.kas_awal} divider />
        <StatementRow label="Kenaikan Kas Bersih" value={arusKas.kenaikan_kas_bersih} emphasis />
        <StatementRow label="Kas Akhir" value={arusKas.kas_akhir} divider emphasis large />
      </BentoCard>
    </div>
  );
}
