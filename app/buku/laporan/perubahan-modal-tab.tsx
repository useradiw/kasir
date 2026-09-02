"use client";

import { BentoCard, CardLabel } from "@/components/shell/ui";
import type { LaporanKeuangan } from "@/app/actions/admin/queries/laporan-keuangan-queries";
import { StatementRow, EmptyBookNotice } from "./statement-row";

/**
 * Perubahan Modal (changes in equity) tab — reskin of app/admin/keuangan/
 * laporan/_components/perubahan-modal-tab.tsx (mockup 4). The engine
 * (lib/accounting/changesInEquity.ts) keeps `prive` DEBIT-POSITIVE (a
 * positive number means money was withdrawn) — displayed here NEGATED so it
 * reads as a reduction, matching lib/laporan-csv.ts and lib/calk.ts's
 * "Ekuitas" section exactly. modal_akhir itself comes straight out of
 * getLaporanKeuangan; this component does not re-derive
 * modal_awal + tambahan_modal + laba_bersih - prive itself (see
 * test/buku-laporan.test.ts for the guard on that formula).
 */
export function PerubahanModalTab({ laporan, isEmpty }: { laporan: LaporanKeuangan; isEmpty: boolean }) {
  const { perubahanModal } = laporan;

  return (
    <div className="flex flex-col gap-3">
      {isEmpty && <EmptyBookNotice />}
      <BentoCard className="flex flex-col gap-0.5">
        <CardLabel>Perubahan Modal</CardLabel>
        <StatementRow label="Modal Awal" value={perubahanModal.modal_awal} />
        <StatementRow label="Tambahan Modal" value={perubahanModal.tambahan_modal} />
        <StatementRow label="Laba Bersih" value={perubahanModal.laba_bersih} />
        <StatementRow
          label="Prive"
          value={-perubahanModal.prive}
          negative={perubahanModal.prive !== 0}
        />
        <StatementRow label="Modal Akhir" value={perubahanModal.modal_akhir} divider emphasis large />
      </BentoCard>
    </div>
  );
}
