"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminSelect, ErrorBanner } from "@/components/admin/ui";
import { DecimalInput } from "@/components/ui/decimal-input";
import { BentoCard, CardLabel } from "@/components/shell/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { formatRupiah } from "@/lib/format";
import { Field, todayISO } from "./form-ui";
import { VARIANT_TITLE, PILL_LABEL, JENIS_VALUES, type Jenis } from "./variants";

export { VARIANT_TITLE, PILL_LABEL, JENIS_VALUES };
export type { Jenis };
import { computeLineJumlah, sumJumlah } from "./totals";
import type { PengeluaranData } from "@/lib/keuangan-schema";
import {
  recordTransfer,
  recordModal,
  recordPrive,
  recordSaldoAwal,
} from "@/app/actions/admin/keuangan";

const SUBMIT_LABEL: Record<Jenis, string> = {
  belanja: "Simpan Pengeluaran",
  transfer: "Simpan Transfer",
  modal: "Simpan Setoran Modal",
  prive: "Simpan Prive",
  "saldo-awal": "Simpan Saldo Awal",
};

// Tercatat sebagai jurnal berimbang note for the four ledger-entry variants;
// saldo-awal gets its own note because it is explicitly NOT income/expense.
const CONFIRM_NOTE: Record<Jenis, string> = {
  belanja: "Tercatat sebagai jurnal berimbang — nomor otomatis, bisa di-void",
  transfer: "Tercatat sebagai jurnal berimbang — nomor otomatis, bisa di-void",
  modal: "Tercatat sebagai jurnal berimbang — nomor otomatis, bisa di-void",
  prive: "Tercatat sebagai jurnal berimbang — nomor otomatis, bisa di-void",
  "saldo-awal": "Bukan pendapatan — hanya titik awal penghitungan",
};

// Which simple fields render, and in what order, for the four non-belanja
// variants (SPEC #13's shared template). Belanja's fields (akun, kategori,
// item, multi-line qty x harga) are shaped too differently to fit this table
// and are rendered in their own block below — one variant with its own
// shape, not five parallel branches.
type SimpleFieldKey = "dari" | "ke" | "nama" | "akun" | "jumlah" | "catatan";
const SIMPLE_FIELDS: Record<Exclude<Jenis, "belanja">, SimpleFieldKey[]> = {
  transfer: ["dari", "ke", "jumlah", "catatan"],
  modal: ["nama", "akun", "jumlah", "catatan"],
  prive: ["akun", "jumlah", "catatan"],
  "saldo-awal": ["akun", "jumlah"],
};

type CashAccount = { name: string; label: string };
type Category = { code: string; name: string; bucket: "BAHAN_BAKU" | "OPERASIONAL" };
type Line = { qty: string; hargaSatuan: string };

export function EntryForm({
  jenis,
  cashAccounts,
  categories = [],
  action,
  saldoAwalEmpty = false,
}: {
  jenis: Jenis;
  cashAccounts: CashAccount[];
  categories?: Category[];
  /** Only used for jenis === "belanja" — recordPengeluaran on /buku/pengeluaran,
   *  recordPengeluaranAsStaff on /buku/belanja (task B). The other four
   *  variants call their fixed action directly, unchanged. */
  action: (data: PengeluaranData) => Promise<{ id: string }>;
  saldoAwalEmpty?: boolean;
}) {
  const router = useRouter();
  const { isPending, run, error, setError } = useAdminAction();
  const [date, setDate] = useState(todayISO());
  const [dari, setDari] = useState(cashAccounts[0]?.name ?? "");
  const [ke, setKe] = useState(cashAccounts[1]?.name ?? cashAccounts[0]?.name ?? "");
  const [akun, setAkun] = useState(cashAccounts[0]?.name ?? "");
  const [nama, setNama] = useState("");
  const [jumlah, setJumlah] = useState("0");
  const [catatan, setCatatan] = useState("");
  const [notice, setNotice] = useState("");

  // Belanja-only state: akun/kategori/item plus the multi-line qty x harga block.
  const [kategoriCode, setKategoriCode] = useState(categories[0]?.code ?? "");
  const [item, setItem] = useState("");
  const [lines, setLines] = useState<Line[]>([{ qty: "1", hargaSatuan: "0" }]);
  // DecimalInput keeps its own text state (seeded from defaultValue), so
  // bumping this key remounts every line's qty input after a successful save
  // — same remount trick as the old pengeluaran-form.tsx.
  const [formKey, setFormKey] = useState(0);

  const noKas = cashAccounts.length === 0;
  const noKategori = jenis === "belanja" && categories.length === 0;
  const needsSetup = noKas || noKategori;

  function addLine() {
    setLines((prev) => [...prev, { qty: "1", hargaSatuan: "0" }]);
  }
  function removeLine(i: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }
  function updateLine(i: number, field: keyof Line, value: string) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  }

  const lineTotal = sumJumlah(
    lines.map((l) => ({ jumlah: computeLineJumlah(Number(l.qty) || 0, Number(l.hargaSatuan) || 0) })),
  );

  function submitBelanja(e: React.FormEvent) {
    e.preventDefault();
    setNotice("");
    run(async () => {
      const total = lines.length;
      let savedCount = 0;
      try {
        for (const line of lines) {
          const qty = Number(line.qty) || 0;
          const hargaSatuan = Number(line.hargaSatuan) || 0;
          const jml = computeLineJumlah(qty, hargaSatuan);
          await action({ date, akun, item, qty, hargaSatuan, jumlah: jml, kategoriCode });
          savedCount++;
        }
      } catch (err) {
        // There is no server action that posts every line in one transaction
        // (the spec explicitly asks for one recordPengeluaran call per line,
        // sequentially), so a failure partway through is a real, honest
        // partial state — never silently retried or rolled back. Drop only
        // the lines that already posted, so resubmitting cannot double-post
        // them, and keep the failed line plus everything after it for the
        // owner to fix and resend.
        const message = err instanceof Error ? err.message : "Terjadi kesalahan.";
        setLines((prev) => prev.slice(savedCount));
        setFormKey((k) => k + 1);
        // The lines that did post are already in the ledger, so refresh even on
        // the failure path — otherwise the list below the form would keep
        // showing the pre-submit state and hide real entries.
        if (savedCount > 0) router.refresh();
        throw new Error(
          `${savedCount} dari ${total} item tersimpan. Item ${savedCount + 1} gagal: ${message}. ` +
            "Perbaiki lalu masukkan sisanya.",
        );
      }
      setItem("");
      setLines([{ qty: "1", hargaSatuan: "0" }]);
      setFormKey((k) => k + 1);
      router.refresh();
    }, { successMessage: "Pengeluaran dicatat" });
  }

  function submitSimple(e: React.FormEvent) {
    e.preventDefault();
    setNotice("");
    const jml = Number(jumlah);
    run(async () => {
      if (jenis === "transfer") {
        await recordTransfer({ date, dari, ke, jumlah: jml, catatan });
      } else if (jenis === "modal") {
        await recordModal({ date, nama, akun, jumlah: jml, catatan });
      } else if (jenis === "prive") {
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

  return (
    <BentoCard>
      <form onSubmit={jenis === "belanja" ? submitBelanja : submitSimple} className="flex flex-col gap-2.5">
        <CardLabel>{VARIANT_TITLE[jenis]}</CardLabel>

        {needsSetup && (
          <p className="rounded-xl bg-warning-soft p-2.5 text-[11.5px] font-semibold text-warning-foreground">
            {jenis === "belanja" && noKategori
              ? "Tambahkan minimal satu akun kas dan satu kategori dulu."
              : (
                <>
                  Tambahkan minimal satu akun kas dulu di{" "}
                  <Link href="/buku/akun" className="cursor-pointer underline">halaman Akun Kas</Link>.
                </>
              )}
          </p>
        )}

        <Field label="Tanggal">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>

        {jenis === "belanja" ? (
          <>
            <Field label="Akun kas">
              <AdminSelect className="w-full" value={akun} onChange={(e) => setAkun(e.target.value)} required>
                {cashAccounts.map((a) => <option key={a.name} value={a.name}>{a.label}</option>)}
              </AdminSelect>
            </Field>
            <Field label="Kategori">
              <AdminSelect className="w-full" value={kategoriCode} onChange={(e) => setKategoriCode(e.target.value)} required>
                {categories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.bucket === "BAHAN_BAKU" ? "Bahan Baku" : "Operasional"})
                  </option>
                ))}
              </AdminSelect>
            </Field>
            <Field label="Nama / keterangan">
              <Input
                value={item}
                onChange={(e) => { setItem(e.target.value); setError(null); }}
                placeholder="Mis. Daging kambing — Pasar Katamso"
                required
              />
            </Field>

            <div className="flex flex-col gap-2">
              {lines.map((line, i) => (
                <div key={i} className="rounded-2xl border border-border bg-card-2 p-3">
                  <div className="flex items-center justify-between">
                    <CardLabel>Item {i + 1}</CardLabel>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        className="cursor-pointer text-[11.5px] font-bold text-destructive"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {/* DecimalInput, not <Input type="number">: Indonesian users
                        type "0,5" and a number input silently discards the
                        comma, leaving the total at 0. */}
                    <DecimalInput
                      key={`${formKey}-${i}`}
                      defaultValue={line.qty === "" ? null : Number(line.qty)}
                      onValueChange={(v) => updateLine(i, "qty", v === null ? "" : String(v))}
                      placeholder="Qty"
                    />
                    <Input
                      type="number"
                      min={0}
                      value={line.hargaSatuan}
                      onChange={(e) => updateLine(i, "hargaSatuan", e.target.value)}
                      placeholder="Harga satuan"
                    />
                  </div>
                  <p className="mt-1.5 text-right text-[11.5px] font-bold tabular-nums text-muted-foreground">
                    {formatRupiah(computeLineJumlah(Number(line.qty) || 0, Number(line.hargaSatuan) || 0))}
                  </p>
                </div>
              ))}
              <button
                type="button"
                onClick={addLine}
                className="cursor-pointer rounded-2xl border border-dashed border-primary/50 p-3 text-center text-[13px] font-bold text-primary"
              >
                ＋ Tambah item
              </button>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border bg-card-2 p-3.5">
              <span className="text-[12.5px] font-bold">Total keluar dari kas</span>
              <span className="font-display text-[17px] font-bold tabular-nums">{formatRupiah(lineTotal)}</span>
            </div>
          </>
        ) : (
          SIMPLE_FIELDS[jenis].map((f) => {
            switch (f) {
              case "dari":
                return (
                  <Field key="dari" label="Dari">
                    <AdminSelect className="w-full" value={dari} onChange={(e) => { setDari(e.target.value); setError(null); }} required>
                      {cashAccounts.map((a) => <option key={a.name} value={a.name}>{a.label}</option>)}
                    </AdminSelect>
                  </Field>
                );
              case "ke":
                return (
                  <Field key="ke" label="Ke">
                    <AdminSelect className="w-full" value={ke} onChange={(e) => setKe(e.target.value)} required>
                      {cashAccounts.map((a) => <option key={a.name} value={a.name}>{a.label}</option>)}
                    </AdminSelect>
                  </Field>
                );
              case "nama":
                return (
                  <Field key="nama" label="Nama penyetor">
                    <Input value={nama} onChange={(e) => { setNama(e.target.value); setError(null); }} placeholder="Mis. Adi" required />
                  </Field>
                );
              case "akun":
                return (
                  <Field key="akun" label="Akun kas">
                    <AdminSelect className="w-full" value={akun} onChange={(e) => { setAkun(e.target.value); setError(null); }} required>
                      {cashAccounts.map((a) => <option key={a.name} value={a.name}>{a.label}</option>)}
                    </AdminSelect>
                  </Field>
                );
              case "jumlah":
                return (
                  <Field key="jumlah" label="Jumlah (Rp)">
                    <Input type="number" min={0} step={1} inputMode="numeric" value={jumlah} onChange={(e) => setJumlah(e.target.value)} required />
                  </Field>
                );
              case "catatan":
                return (
                  <Field key="catatan" label="Catatan">
                    <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} />
                  </Field>
                );
            }
          })
        )}

        {jenis === "saldo-awal" && saldoAwalEmpty && (
          <p className="rounded-xl bg-primary-soft p-2.5 text-[11.5px] font-semibold text-primary">
            Bulan ini belum punya saldo awal — hitung uang &amp; posisi riil hari cutover, catat di sini.
          </p>
        )}

        <ErrorBanner error={error} />
        {notice && <p className="text-[11.5px] font-semibold text-warning-foreground">{notice}</p>}

        <Button type="submit" disabled={isPending || needsSetup} className="w-full">
          {isPending ? "Menyimpan…" : SUBMIT_LABEL[jenis]}
        </Button>
        <p className="text-center text-[11px] font-semibold text-muted-foreground">{CONFIRM_NOTE[jenis]}</p>
      </form>
    </BentoCard>
  );
}
