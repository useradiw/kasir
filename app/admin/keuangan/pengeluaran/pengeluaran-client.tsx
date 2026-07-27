"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminSelect, ErrorBanner } from "@/components/admin/ui";
import { DecimalInput } from "@/components/ui/decimal-input";
import { useAdminAction } from "@/hooks/use-admin-action";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { formatRupiah } from "@/lib/format";
import { Field, todayISO } from "../_components/form-ui";
import { recordPengeluaran, voidPengeluaran } from "@/app/actions/admin/keuangan";

type CashAccount = { name: string; label: string };
type Category = { code: string; name: string; bucket: "HPP" | "OPEX" };
type Row = {
  id: string;
  date: string;
  item: string;
  qty: number | string;
  jumlah: number;
  akun: string;
  kategoriCode: string;
  kategoriNama: string | null;
};

export function PengeluaranClient({
  cashAccounts,
  categories,
  rows,
  month,
}: {
  cashAccounts: CashAccount[];
  categories: Category[];
  rows: Row[];
  month: string;
}) {
  const router = useRouter();
  const { isPending, run, error } = useAdminAction();
  const confirm = useConfirm();
  const [date, setDate] = useState(todayISO());
  const [akun, setAkun] = useState(cashAccounts[0]?.name ?? "");
  const [kategoriCode, setKategoriCode] = useState(categories[0]?.code ?? "");
  const [item, setItem] = useState("");
  const [qty, setQty] = useState("1");
  const [hargaSatuan, setHargaSatuan] = useState("0");
  const [jumlah, setJumlah] = useState("0");
  // DecimalInput keeps its own text state (seeded from defaultValue), so bumping
  // this key remounts it when the form is reset after a successful save.
  const [formKey, setFormKey] = useState(0);

  const needsSetup = cashAccounts.length === 0 || categories.length === 0;

  function recompute(nextQty: string, nextHarga: string) {
    const q = Number(nextQty) || 0;
    const h = Number(nextHarga) || 0;
    setJumlah(String(Math.round(q * h)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(async () => {
      await recordPengeluaran({
        date,
        akun,
        item,
        qty: Number(qty),
        hargaSatuan: Number(hargaSatuan),
        jumlah: Number(jumlah),
        kategoriCode,
      });
      setItem("");
      setQty("1");
      setHargaSatuan("0");
      setJumlah("0");
      setFormKey((k) => k + 1);
      router.refresh();
    }, { successMessage: "Pengeluaran dicatat" });
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "Hapus (void) pengeluaran ini?", destructive: true, confirmLabel: "Hapus" }))) return;
    run(async () => {
      await voidPengeluaran(id);
      router.refresh();
    }, { successMessage: "Pengeluaran dihapus" });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <form onSubmit={submit} className="h-fit space-y-3 rounded-lg border bg-card p-4">
        <p className="text-sm font-medium">Catat Pengeluaran</p>
        {needsSetup && (
          <p className="rounded-md bg-warning/10 p-2 text-xs text-warning-foreground">
            Tambahkan minimal satu akun kas dan satu kategori dulu.
          </p>
        )}
        <Field label="Tanggal">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Akun kas">
          <AdminSelect className="w-full" value={akun} onChange={(e) => setAkun(e.target.value)} required>
            {cashAccounts.map((a) => <option key={a.name} value={a.name}>{a.label}</option>)}
          </AdminSelect>
        </Field>
        <Field label="Kategori">
          <AdminSelect className="w-full" value={kategoriCode} onChange={(e) => setKategoriCode(e.target.value)} required>
            {categories.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.bucket})</option>)}
          </AdminSelect>
        </Field>
        <Field label="Item">
          <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Mis. Bayar listrik PLN" required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Qty">
            {/* DecimalInput, not <Input type="number">: Indonesian users type
                "0,5" and a number input silently discards the comma, leaving
                the total at 0. Harga/Jumlah stay numeric — whole Rupiah. */}
            <DecimalInput
              key={formKey}
              defaultValue={qty === "" ? null : Number(qty)}
              onValueChange={(v) => {
                const next = v === null ? "" : String(v);
                setQty(next);
                recompute(next, hargaSatuan);
              }}
            />
          </Field>
          <Field label="Harga satuan">
            <Input
              type="number"
              min={0}
              value={hargaSatuan}
              onChange={(e) => { setHargaSatuan(e.target.value); recompute(qty, e.target.value); }}
            />
          </Field>
        </div>
        <Field label="Jumlah (Rp)" hint="Terisi otomatis dari qty x harga; boleh disunting.">
          <Input type="number" min={0} value={jumlah} onChange={(e) => setJumlah(e.target.value)} required />
        </Field>
        <ErrorBanner error={error} />
        <Button type="submit" disabled={isPending || needsSetup}>{isPending ? "Menyimpan..." : "Simpan"}</Button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="border-b px-4 py-2 text-xs text-muted-foreground">
          {rows.length} pengeluaran &middot; {month}
        </div>
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Belum ada pengeluaran bulan ini</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Item</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3 text-right">Jumlah</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                {rows.map((r) => (
                  <tr key={r.id} className="text-sm">
                    <td className="p-3 whitespace-nowrap">{r.date}</td>
                    <td className="p-3 font-medium">{r.item}</td>
                    <td className="p-3">{r.kategoriNama ?? r.kategoriCode}</td>
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
