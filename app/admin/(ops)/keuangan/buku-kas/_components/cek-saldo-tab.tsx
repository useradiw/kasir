"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/shared/badge";
import { AdminSelect, ErrorBanner } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { formatRupiah } from "@/lib/format";
import { Field, todayISO } from "../../_components/form-ui";
import { recordBalanceAssertion } from "@/app/actions/admin/keuangan";
import type { CekSaldoRow } from "@/app/actions/admin/queries/buku-kas-queries";

type CashAccount = { name: string; label: string };

/** A never-counted account is NOT the same as a zero-drift count — it must
 *  never render as "Rp 0" or "Sesuai". */
function SelisihBadge({ selisih }: { selisih: number | null }) {
  if (selisih === null) {
    return <Badge className="bg-muted text-muted-foreground">Belum pernah dihitung</Badge>;
  }
  if (selisih === 0) {
    return <Badge className="bg-primary/10 text-primary">Sesuai</Badge>;
  }
  // selisih = saldoLedger - saldoTercatat (see lib/buku-kas.ts). So a POSITIVE
  // selisih means the buku besar is higher than the money actually counted —
  // i.e. cash is MISSING (kurang). This read "Lebih" for a positive selisih,
  // which showed a shortage as a surplus: exactly backwards, and the kind of
  // thing an owner would act on. Wording is spelled out ("Uang kurang") because
  // a bare "Kurang" is still ambiguous about which side is short.
  return (
    <Badge className="bg-destructive/10 text-destructive">
      {selisih > 0 ? "Uang kurang" : "Uang lebih"} {formatRupiah(Math.abs(selisih))}
    </Badge>
  );
}

function CekSaldoRowCard({ row }: { row: CekSaldoRow }) {
  return (
    <div className="space-y-2 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{row.label}</p>
        <SelisihBadge selisih={row.selisih} />
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Saldo Buku</p>
          <p className="tabular-nums">{formatRupiah(row.saldoLedger)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Saldo Fisik</p>
          {row.saldoTercatat !== null ? (
            <p className="tabular-nums">{formatRupiah(row.saldoTercatat)}</p>
          ) : (
            <p className="text-sm italic text-muted-foreground">Belum pernah dihitung</p>
          )}
        </div>
      </div>
      {row.tanggalTercatat && (
        <p className="text-xs text-muted-foreground">
          Dihitung {row.tanggalTercatat}
          {row.note ? ` — ${row.note}` : ""}
        </p>
      )}
    </div>
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
    <form onSubmit={submit} className="space-y-3 rounded-lg border bg-card p-4">
      <p className="text-sm font-medium">Catat Hasil Hitung</p>
      {noKas && (
        <p className="rounded-md bg-warning/10 p-2 text-xs text-warning-foreground">
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
      <Button type="submit" disabled={isPending || noKas}>
        {isPending ? "Menyimpan..." : "Simpan"}
      </Button>
    </form>
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
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Selisih adalah perbedaan antara saldo buku besar dan uang yang benar-benar dihitung
        secara fisik. Mencatat hasil hitung di sini tidak mengubah buku besar — ini hanya bukti
        catatan uang yang benar-benar ada pada tanggal tersebut.
      </p>

      {rows.length === 0 ? (
        <div className="rounded-lg bg-warning/10 p-3 text-xs text-warning-foreground">
          Belum ada akun kas. Tambahkan dulu di Keuangan &rarr; Akun Kas.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <CekSaldoRowCard key={r.account} row={r} />
          ))}
        </div>
      )}

      <RecordForm cashAccounts={cashAccounts} />
    </div>
  );
}
