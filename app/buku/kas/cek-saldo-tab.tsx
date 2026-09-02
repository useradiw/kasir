"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminSelect, ErrorBanner } from "@/components/admin/ui";
import { BentoCard, CardLabel, Tag } from "@/components/shell/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { formatRupiah } from "@/lib/format";
import { Field, todayISO } from "./form-ui";
import { recordBalanceAssertion } from "@/app/actions/admin/keuangan";
import type { CekSaldoRow } from "@/app/actions/admin/queries";

type CashAccount = { name: string; label: string };

/**
 * Reskin of app/admin/keuangan/buku-kas/_components/cek-saldo-tab.tsx — same
 * selisih sign convention carried across verbatim: selisih = saldoLedger -
 * saldoTercatat, so a POSITIVE selisih means the buku besar is higher than
 * the money actually counted, i.e. cash is MISSING (kurang). Never inverted.
 */
function SelisihTag({ selisih }: { selisih: number | null }) {
  if (selisih === null) return <Tag tone="mut">Belum pernah dihitung</Tag>;
  if (selisih === 0) return <Tag tone="ok">Sesuai</Tag>;
  return (
    <Tag tone="bad">
      {selisih > 0 ? "Uang kurang" : "Uang lebih"} {formatRupiah(Math.abs(selisih))}
    </Tag>
  );
}

function CekSaldoRowCard({ row }: { row: CekSaldoRow }) {
  return (
    <BentoCard className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <CardLabel>{row.label}</CardLabel>
        <SelisihTag selisih={row.selisih} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground">Saldo Buku</p>
          <p className="text-[13.5px] font-bold tabular-nums">{formatRupiah(row.saldoLedger)}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground">Saldo Fisik</p>
          {row.saldoTercatat !== null ? (
            <p className="text-[13.5px] font-bold tabular-nums">{formatRupiah(row.saldoTercatat)}</p>
          ) : (
            <p className="text-[12px] font-semibold italic text-muted-foreground">Belum pernah dihitung</p>
          )}
        </div>
      </div>
      {row.tanggalTercatat && (
        <p className="text-[11px] font-semibold text-muted-foreground">
          Dihitung {row.tanggalTercatat}
          {row.note ? ` — ${row.note}` : ""}
        </p>
      )}
    </BentoCard>
  );
}

function RecordForm({ cashAccounts }: { cashAccounts: CashAccount[] }) {
  const router = useRouter();
  const { isPending, run, error } = useAdminAction();
  const [akun, setAkun] = useState(cashAccounts[0]?.name ?? "");
  const [date, setDate] = useState(todayISO());
  const [jumlah, setJumlah] = useState("0");
  const [catatan, setCatatan] = useState("");
  const noKas = cashAccounts.length === 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const jml = Number(jumlah);
    run(
      async () => {
        await recordBalanceAssertion({
          account: akun,
          date,
          expected: jml,
          note: catatan || undefined,
        });
        setJumlah("0");
        setCatatan("");
        router.refresh();
      },
      { successMessage: "Hasil hitung tersimpan" },
    );
  }

  return (
    <BentoCard>
      <form onSubmit={submit} className="flex flex-col gap-2.5">
        <CardLabel>Catat Hasil Hitung</CardLabel>
        {noKas && (
          <p className="rounded-xl bg-warning-soft p-2.5 text-[11.5px] font-semibold text-warning-foreground">
            Tambahkan minimal satu akun kas dulu di tab Akun Kas.
          </p>
        )}
        <Field label="Akun kas">
          <AdminSelect className="w-full" value={akun} onChange={(e) => setAkun(e.target.value)} required>
            {cashAccounts.map((a) => (
              <option key={a.name} value={a.name}>{a.label}</option>
            ))}
          </AdminSelect>
        </Field>
        <Field label="Tanggal">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Jumlah fisik (Rp)">
          <Input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={jumlah}
            onChange={(e) => setJumlah(e.target.value)}
            required
          />
        </Field>
        <Field label="Catatan (opsional)">
          <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        </Field>
        <ErrorBanner error={error} />
        <Button type="submit" disabled={isPending || noKas} className="w-full">
          {isPending ? "Menyimpan…" : "Simpan"}
        </Button>
      </form>
    </BentoCard>
  );
}

export function CekSaldoTab({
  rows,
  cashAccounts,
}: {
  rows: CekSaldoRow[];
  cashAccounts: CashAccount[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11.5px] font-semibold text-muted-foreground">
        Selisih adalah perbedaan antara saldo buku besar dan uang yang benar-benar dihitung
        secara fisik. Mencatat hasil hitung di sini tidak mengubah buku besar — ini hanya bukti
        catatan uang yang benar-benar ada pada tanggal tersebut.
      </p>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-warning/35 bg-warning-soft p-3.5 text-[12px] font-semibold text-warning-foreground">
          Belum ada akun kas. Tambahkan dulu di <a href="/buku/akun" className="underline">Akun Kas</a>.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((r) => (
            <CekSaldoRowCard key={r.account} row={r} />
          ))}
        </div>
      )}

      <RecordForm cashAccounts={cashAccounts} />
    </div>
  );
}
