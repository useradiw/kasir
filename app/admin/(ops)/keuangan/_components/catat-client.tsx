"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminSelect, ErrorBanner } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { formatRupiah } from "@/lib/format";
import { Field, todayISO } from "./form-ui";
import {
  recordTransfer,
  recordModal,
  recordPrive,
  recordSaldoAwal,
  voidCatat,
} from "@/app/actions/admin/keuangan";

export type CatatKind = "transfer" | "modal" | "prive" | "saldo-awal";
type CashAccount = { name: string; label: string };
type Row = { id: string; date: string; jumlah: number; meta: Record<string, unknown>; narration: string };

const TITLE: Record<CatatKind, string> = {
  transfer: "Transfer Antar Kas",
  modal: "Setoran Modal",
  prive: "Prive (Ambil Pribadi)",
  "saldo-awal": "Saldo Awal",
};

function labelFor(accounts: CashAccount[], name: unknown): string {
  return accounts.find((a) => a.name === name)?.label ?? String(name ?? "—");
}

export function CatatClient({
  kind,
  cashAccounts,
  rows,
  month,
}: {
  kind: CatatKind;
  cashAccounts: CashAccount[];
  rows: Row[];
  month: string;
}) {
  const router = useRouter();
  const { isPending, run, error, setError } = useAdminAction();
  const confirm = useConfirm();
  const [date, setDate] = useState(todayISO());
  const [dari, setDari] = useState(cashAccounts[0]?.name ?? "");
  const [ke, setKe] = useState(cashAccounts[1]?.name ?? cashAccounts[0]?.name ?? "");
  const [akun, setAkun] = useState(cashAccounts[0]?.name ?? "");
  const [nama, setNama] = useState("");
  const [jumlah, setJumlah] = useState("0");
  const [catatan, setCatatan] = useState("");
  const [notice, setNotice] = useState("");

  const noKas = cashAccounts.length === 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setNotice("");
    const jml = Number(jumlah);
    run(async () => {
      if (kind === "transfer") {
        await recordTransfer({ date, dari, ke, jumlah: jml, catatan });
      } else if (kind === "modal") {
        await recordModal({ date, nama, akun, jumlah: jml, catatan });
      } else if (kind === "prive") {
        await recordPrive({ date, akun, jumlah: jml, catatan });
      } else {
        const res = await recordSaldoAwal({ date, akun, jumlah: jml });
        if (res.hasPriorEntries) {
          setNotice("Perhatian: sudah ada entri sebelum tanggal ini — saldo awal berisiko dobel-hitung kas.");
        }
      }
      setJumlah("0");
      setNama("");
      setCatatan("");
      router.refresh();
    }, { successMessage: "Berhasil disimpan" });
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "Hapus (void) entri ini?", destructive: true, confirmLabel: "Hapus" }))) return;
    run(async () => {
      await voidCatat(id, kind);
      router.refresh();
    }, { successMessage: "Entri dihapus" });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <form onSubmit={submit} className="h-fit space-y-3 rounded-lg border bg-card p-4">
        <p className="text-sm font-medium">{TITLE[kind]}</p>
        {noKas && (
          <p className="rounded-md bg-warning/10 p-2 text-xs text-warning-foreground">
            Tambahkan minimal satu akun kas dulu di tab Akun Kas.
          </p>
        )}
        <Field label="Tanggal">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>

        {kind === "transfer" && (
          <>
            <Field label="Dari kas">
              <AdminSelect className="w-full" value={dari} onChange={(e) => { setDari(e.target.value); setError(null); }} required>
                {cashAccounts.map((a) => <option key={a.name} value={a.name}>{a.label}</option>)}
              </AdminSelect>
            </Field>
            <Field label="Ke kas">
              <AdminSelect className="w-full" value={ke} onChange={(e) => setKe(e.target.value)} required>
                {cashAccounts.map((a) => <option key={a.name} value={a.name}>{a.label}</option>)}
              </AdminSelect>
            </Field>
          </>
        )}

        {kind === "modal" && (
          <Field label="Nama penyetor">
            <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Mis. Adi" required />
          </Field>
        )}

        {(kind === "modal" || kind === "prive" || kind === "saldo-awal") && (
          <Field label="Akun kas">
            <AdminSelect className="w-full" value={akun} onChange={(e) => setAkun(e.target.value)} required>
              {cashAccounts.map((a) => <option key={a.name} value={a.name}>{a.label}</option>)}
            </AdminSelect>
          </Field>
        )}

        <Field label="Jumlah (Rp)">
          <Input type="number" min={0} step={1} inputMode="numeric" value={jumlah} onChange={(e) => setJumlah(e.target.value)} required />
        </Field>

        {kind !== "saldo-awal" && (
          <Field label="Catatan (opsional)">
            <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} />
          </Field>
        )}

        <ErrorBanner error={error} />
        {notice && <p className="text-xs text-warning-foreground">{notice}</p>}
        <Button type="submit" disabled={isPending || noKas}>{isPending ? "Menyimpan..." : "Simpan"}</Button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="border-b px-4 py-2 text-xs text-muted-foreground">
          {rows.length} entri &middot; {month}
        </div>
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Belum ada entri bulan ini</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Keterangan</th>
                  <th className="p-3 text-right">Jumlah</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                {rows.map((r) => (
                  <tr key={r.id} className="text-sm">
                    <td className="p-3 whitespace-nowrap">{r.date}</td>
                    <td className="p-3">
                      {kind === "transfer"
                        ? `${labelFor(cashAccounts, r.meta["dari"])} → ${labelFor(cashAccounts, r.meta["ke"])}`
                        : kind === "modal"
                          ? `${String(r.meta["nama"] ?? "")} · ${labelFor(cashAccounts, r.meta["akun"])}`
                          : labelFor(cashAccounts, r.meta["akun"])}
                      {r.meta["catatan"] ? (
                        <span className="text-muted-foreground"> — {String(r.meta["catatan"])}</span>
                      ) : null}
                    </td>
                    <td className="p-3 text-right tabular-nums">{formatRupiah(r.jumlah)}</td>
                    <td className="p-3 text-right">
                      <Button size="xs" variant="destructive" disabled={isPending} onClick={() => remove(r.id)}>
                        Void
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
