"use client";

import { BentoCard, CardLabel, Row, Tag } from "@/components/shell/ui";
import type { LaporanKeuangan } from "@/app/actions/admin/queries/laporan-keuangan-queries";
import { StatementRow, EmptyBookNotice } from "./statement-row";
import { totalEkuitasDanLiabilitas } from "./totals";

/**
 * Neraca tab — reskin of app/admin/keuangan/laporan/_components/
 * neraca-tab.tsx (mockup 2). Same three sections (Aset / Kewajiban /
 * Ekuitas) and the same balanced/TIDAK-seimbang badge, now a header Row
 * with a Tag instead of a Badge. Mockup 2 shows one combined "Total Ekuitas
 * + Liabilitas" row rather than the old screen's separate "Total Ekuitas"
 * and "Total Kewajiban" figures — totals.ts computes that sum (the one new
 * piece of screen-level arithmetic this rebuild adds; see its doc comment).
 */
export function NeracaTab({ laporan, isEmpty }: { laporan: LaporanKeuangan; isEmpty: boolean }) {
  const { neraca } = laporan;

  return (
    <div className="flex flex-col gap-3">
      {isEmpty && <EmptyBookNotice />}

      <Row title="Status Neraca">
        <Tag tone={neraca.balanced ? "ok" : "bad"}>
          {neraca.balanced ? "✓ Seimbang" : "TIDAK Seimbang"}
        </Tag>
      </Row>

      <BentoCard className="flex flex-col gap-0.5">
        <CardLabel>Aset</CardLabel>
        {neraca.aset.lines.length === 0 ? (
          <p className="py-2 text-[12.5px] font-semibold text-muted-foreground">Belum ada akun kas</p>
        ) : (
          neraca.aset.lines.map((l) => <StatementRow key={l.account} label={l.label} value={l.amount} indent />)
        )}
        <StatementRow label="Total Aset" value={neraca.aset.total} divider emphasis large />
      </BentoCard>

      <BentoCard className="flex flex-col gap-0.5">
        <CardLabel>Kewajiban</CardLabel>
        <StatementRow label="Total Kewajiban" value={neraca.kewajiban.total} emphasis />
      </BentoCard>

      <BentoCard className="flex flex-col gap-0.5">
        <CardLabel>Ekuitas</CardLabel>
        {neraca.ekuitas.lines.map((l) => (
          <StatementRow key={l.label} label={l.label} value={l.amount} indent />
        ))}
        <StatementRow
          label="Total Ekuitas + Liabilitas"
          value={totalEkuitasDanLiabilitas(neraca)}
          divider
          emphasis
          large
        />
      </BentoCard>
    </div>
  );
}
