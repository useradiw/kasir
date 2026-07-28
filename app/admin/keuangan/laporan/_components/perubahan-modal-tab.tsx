"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LaporanKeuangan } from "@/app/actions/admin/queries/laporan-keuangan-queries";
import { StatementRow, EmptyBookNotice } from "./statement-row";

/**
 * Perubahan Modal (changes in equity) tab. The engine (lib/accounting/
 * changesInEquity.ts) keeps `prive` DEBIT-POSITIVE (a positive number means
 * money was withdrawn) — displayed here NEGATED so it reads as a reduction,
 * matching lib/laporan-csv.ts and lib/calk.ts's "Ekuitas" section exactly.
 */
export function PerubahanModalTab({ laporan, isEmpty }: { laporan: LaporanKeuangan; isEmpty: boolean }) {
  const { perubahanModal } = laporan;

  return (
    <div className="space-y-4">
      {isEmpty && <EmptyBookNotice />}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Perubahan Modal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <StatementRow label="Modal Awal" value={perubahanModal.modal_awal} />
          <StatementRow label="Tambahan Modal" value={perubahanModal.tambahan_modal} />
          <StatementRow label="Laba Bersih" value={perubahanModal.laba_bersih} />
          <StatementRow
            label="Prive"
            value={-perubahanModal.prive}
            negative={perubahanModal.prive !== 0}
          />
          <StatementRow label="Modal Akhir" value={perubahanModal.modal_akhir} divider emphasis large />
        </CardContent>
      </Card>
    </div>
  );
}
