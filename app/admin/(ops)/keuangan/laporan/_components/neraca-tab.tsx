"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/shared/badge";
import type { LaporanKeuangan } from "@/app/actions/admin/queries/laporan-keuangan-queries";
import { StatementRow, EmptyBookNotice } from "./statement-row";

export function NeracaTab({ laporan, isEmpty }: { laporan: LaporanKeuangan; isEmpty: boolean }) {
  const { neraca } = laporan;

  return (
    <div className="space-y-4">
      {isEmpty && <EmptyBookNotice />}
      <div className="flex items-center justify-between rounded-lg border bg-card p-3">
        <span className="text-sm font-medium">Status Neraca</span>
        <Badge
          className={
            neraca.balanced
              ? "bg-primary/10 text-primary"
              : "bg-destructive/10 text-destructive"
          }
        >
          {neraca.balanced ? "Seimbang" : "TIDAK seimbang"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Aset</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {neraca.aset.lines.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">Belum ada akun kas</p>
          ) : (
            neraca.aset.lines.map((l) => (
              <StatementRow key={l.account} label={l.label} value={l.amount} indent />
            ))
          )}
          <StatementRow label="Total Aset" value={neraca.aset.total} divider emphasis large />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Kewajiban</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <StatementRow label="Total Kewajiban" value={neraca.kewajiban.total} emphasis />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Ekuitas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {neraca.ekuitas.lines.map((l) => (
            <StatementRow key={l.label} label={l.label} value={l.amount} indent />
          ))}
          <StatementRow label="Total Ekuitas" value={neraca.ekuitas.total} divider emphasis large />
        </CardContent>
      </Card>
    </div>
  );
}
