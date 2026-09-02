"use client";

import { BentoCard, CardLabel, Row } from "@/components/shell/ui";
import { formatRupiah } from "@/lib/format";
import type { BukuKasAccount } from "@/app/actions/admin/queries";

/**
 * Reskin of app/admin/keuangan/buku-kas/_components/buku-kas-tab.tsx on the
 * new design system — every column and behaviour carried across unchanged.
 * Movements stay a stacked row per entry (date/no. jurnal, keterangan,
 * masuk/keluar/saldo) rather than a horizontal-scroll table, same reasoning
 * the old tab's comment gave: at phone width a 6-column table is either
 * unreadably cramped or forces sideways scroll to see the running saldo.
 *
 * Money invariant on this screen: saldoAwal + sum(masuk) - sum(keluar) ===
 * saldoAkhir. getBukuKas (lib/buku-kas.ts) already guarantees and tests this
 * (test/buku-kas.test.ts) — this component only displays the numbers the
 * query returns, it never re-derives them.
 *
 * Gap (known, not built): mockup 4 says "tiap entri bisa dibuka ke
 * jurnalnya" — each movement should open its journal entry. BukuKasMovement
 * carries a journal `number` but no journal entry id, and there is no query
 * that fetches one journal entry by id/number. Building that drill-down
 * would mean inventing a new query, which is out of scope here.
 */
function MovementRow({ m }: { m: BukuKasAccount["movements"][number] }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-2.5 last:border-b-0">
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-muted-foreground">
        <span>{m.date}</span>
        {m.number !== null && <span>No. {m.number}</span>}
      </div>
      <p className="text-[12.5px] font-semibold">{m.narration}</p>
      <div className="grid grid-cols-3 gap-2 text-[11.5px]">
        <div>
          <span className="text-muted-foreground">Masuk </span>
          <span className="tabular-nums font-bold text-success">
            {m.masuk > 0 ? formatRupiah(m.masuk) : "—"}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Keluar </span>
          <span className="tabular-nums font-bold text-destructive">
            {m.keluar > 0 ? formatRupiah(m.keluar) : "—"}
          </span>
        </div>
        <div className="text-right">
          <span className="text-muted-foreground">Saldo </span>
          <span className="tabular-nums font-bold">{formatRupiah(m.saldo)}</span>
        </div>
      </div>
    </div>
  );
}

function AccountCard({ acc }: { acc: BukuKasAccount }) {
  return (
    <BentoCard className="flex flex-col gap-2.5">
      <CardLabel>{acc.label}</CardLabel>
      <Row title="Saldo Awal" meta={null}>
        <span className="shrink-0 text-[13px] font-bold tabular-nums">{formatRupiah(acc.saldoAwal)}</span>
      </Row>
      {acc.movements.length === 0 ? (
        <p className="rounded-xl bg-card-2 p-3 text-center text-[12px] font-semibold text-muted-foreground">
          Belum ada mutasi bulan ini.
        </p>
      ) : (
        <div className="rounded-2xl border border-border bg-card-2 px-3">
          {acc.movements.map((m, i) => (
            <MovementRow key={i} m={m} />
          ))}
        </div>
      )}
      <Row title="Saldo Akhir" meta={null} className="bg-card-2">
        <span className="shrink-0 font-display text-[15px] font-bold tabular-nums">
          {formatRupiah(acc.saldoAkhir)}
        </span>
      </Row>
    </BentoCard>
  );
}

export function BukuKasTab({ accounts }: { accounts: BukuKasAccount[] }) {
  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl border border-warning/35 bg-warning-soft p-3.5 text-[12px] font-semibold text-warning-foreground">
        Belum ada akun kas. Tambahkan dulu di{" "}
        <a href="/buku/akun" className="underline">Akun Kas</a>, lalu atur Akun Penjualan agar
        penjualan mulai tercatat ke buku kas ini.
      </div>
    );
  }

  const allEmpty = accounts.every(
    (a) => a.saldoAwal === 0 && a.saldoAkhir === 0 && a.movements.length === 0,
  );

  return (
    <div className="flex flex-col gap-3">
      {allEmpty && (
        <div className="rounded-2xl border border-warning/35 bg-warning-soft p-3.5 text-[12px] font-semibold text-warning-foreground">
          Belum ada transaksi tercatat ke buku besar bulan ini, jadi semua angka di bawah masih
          Rp 0 — ini bukan berarti rusak. Pastikan dulu: isi akun default, buat minimal satu akun
          kas di <a href="/buku/akun" className="underline">Akun Kas</a>, lalu atur Akun Penjualan di{" "}
          <a href="/buku/akun-penjualan" className="underline">Akun Penjualan</a> untuk tunai,
          elektronik dan online. Setelah itu, tutup kas dan pencairan online akan mulai mengisi
          buku kas ini.
        </div>
      )}
      {accounts.map((acc) => (
        <AccountCard key={acc.account} acc={acc} />
      ))}
    </div>
  );
}
