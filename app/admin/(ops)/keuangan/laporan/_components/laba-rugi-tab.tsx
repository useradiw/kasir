"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LaporanKeuangan } from "@/app/actions/admin/queries/laporan-keuangan-queries";
import { StatementRow, EmptyBookNotice } from "./statement-row";

export function LabaRugiTab({ laporan, isEmpty }: { laporan: LaporanKeuangan; isEmpty: boolean }) {
  const { labaRugi } = laporan;

  return (
    <div className="space-y-4">
      {isEmpty && <EmptyBookNotice />}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Laba Rugi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <StatementRow label="Tunai" value={labaRugi.pendapatan.tunai} indent />
          <StatementRow label="QRIS" value={labaRugi.pendapatan.qris} indent />
          <StatementRow label="Online" value={labaRugi.pendapatan.online} indent />
          <StatementRow label="Total Pendapatan" value={labaRugi.pendapatan.total} divider emphasis />

          {labaRugi.hpp.lines.map((l) => (
            <StatementRow key={l.account} label={l.label} value={-l.amount} indent negative />
          ))}
          <StatementRow label="Total HPP" value={-labaRugi.hpp.total} negative divider />

          <StatementRow label="Laba Kotor" value={labaRugi.laba_kotor} divider emphasis />

          {labaRugi.biaya_operasional.lines.map((l) => (
            <StatementRow key={l.account} label={l.label} value={-l.amount} indent negative />
          ))}
          <StatementRow label="Total Biaya Operasional" value={-labaRugi.biaya_operasional.total} negative divider />

          <StatementRow label="Laba Bersih" value={labaRugi.laba_bersih} divider emphasis large />
        </CardContent>
      </Card>
    </div>
  );
}
