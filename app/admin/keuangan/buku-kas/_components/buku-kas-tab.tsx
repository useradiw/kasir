"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah } from "@/lib/format";
import { StatementRow, EmptyBookNotice } from "../../laporan/_components/statement-row";
import type { BukuKasAccount } from "@/app/actions/admin/queries/buku-kas-queries";

/**
 * Movements are rendered as a stacked row per entry (date/no. jurnal on one
 * line, keterangan below, masuk/keluar/saldo in a 3-column strip) rather than
 * a 6-column horizontal-scroll table. At 375px a Tanggal/No/Keterangan/
 * Masuk/Keluar/Saldo table is either unreadably cramped or forces sideways
 * scroll to see the running saldo, which is the one number a cashier's
 * eye needs next to the date. The stacked layout keeps every movement's
 * three money figures visible without scrolling.
 */
function MovementRow({ m }: { m: BukuKasAccount["movements"][number] }) {
  return (
    <div className="space-y-1 py-2.5">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{m.date}</span>
        {m.number !== null && <span>No. {m.number}</span>}
      </div>
      <p className="text-sm">{m.narration}</p>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Masuk </span>
          <span className="tabular-nums text-primary">
            {m.masuk > 0 ? formatRupiah(m.masuk) : "—"}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Keluar </span>
          <span className="tabular-nums text-destructive">
            {m.keluar > 0 ? formatRupiah(m.keluar) : "—"}
          </span>
        </div>
        <div className="text-right">
          <span className="text-muted-foreground">Saldo </span>
          <span className="tabular-nums font-medium">{formatRupiah(m.saldo)}</span>
        </div>
      </div>
    </div>
  );
}

function AccountCard({ acc }: { acc: BukuKasAccount }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{acc.label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        <StatementRow label="Saldo Awal" value={acc.saldoAwal} />
        {acc.movements.length === 0 ? (
          <p className="border-y border-foreground/10 py-3 text-xs text-muted-foreground">
            Belum ada mutasi bulan ini.
          </p>
        ) : (
          <div className="divide-y divide-foreground/5 border-y border-foreground/10">
            {acc.movements.map((m, i) => (
              <MovementRow key={i} m={m} />
            ))}
          </div>
        )}
        <StatementRow label="Saldo Akhir" value={acc.saldoAkhir} emphasis />
      </CardContent>
    </Card>
  );
}

export function BukuKasTab({ accounts }: { accounts: BukuKasAccount[] }) {
  if (accounts.length === 0) {
    return (
      <div className="rounded-lg bg-warning/10 p-3 text-xs text-warning-foreground">
        Belum ada akun kas. Tambahkan dulu di Keuangan &rarr; Akun Kas, lalu atur Akun Penjualan
        agar penjualan mulai tercatat ke buku kas ini.
      </div>
    );
  }

  const allEmpty = accounts.every(
    (a) => a.saldoAwal === 0 && a.saldoAkhir === 0 && a.movements.length === 0,
  );

  return (
    <div className="space-y-4">
      {allEmpty && <EmptyBookNotice />}
      {accounts.map((acc) => (
        <AccountCard key={acc.account} acc={acc} />
      ))}
    </div>
  );
}
