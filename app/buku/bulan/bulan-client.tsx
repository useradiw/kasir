"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertRow, BentoCard, CardLabel, Row, Tag } from "@/components/shell/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { formatMonth } from "@/lib/format";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { lockMonth, unlockMonth, createMonth, setSelectedMonth } from "@/app/actions/admin/keuangan";

type Month = { month: string; locked: boolean };

function thisMonthISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function NewMonthForm() {
  const router = useRouter();
  const { isPending, run, error } = useAdminAction();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(thisMonthISO());

  function create() {
    run(
      async () => {
        await createMonth({ month });
        setOpen(false);
        router.refresh();
      },
      { successMessage: `Bulan ${formatMonth(month)} dibuat` },
    );
  }

  if (!open) {
    return (
      <Button variant="outline" disabled={isPending} onClick={() => setOpen(true)} className="w-full">
        + Bulan baru
      </Button>
    );
  }

  return (
    <BentoCard>
      <CardLabel>Buat bulan baru</CardLabel>
      <div className="mt-2.5 flex flex-col gap-2.5">
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
        <div className="flex gap-2">
          <Button disabled={isPending} onClick={create} className="flex-1">
            {isPending ? "Menyimpan…" : "Simpan"}
          </Button>
          <Button variant="ghost" disabled={isPending} onClick={() => setOpen(false)}>
            Batal
          </Button>
        </div>
      </div>
    </BentoCard>
  );
}

function MonthCard({ m, active }: { m: Month; active: boolean }) {
  const router = useRouter();
  const { isPending, run, error } = useAdminAction();
  const confirm = useConfirm();

  // Sets the wb_month cookie every other Keuangan screen reads. No confirm:
  // it changes what you are looking at, nothing in the ledger.
  function pakai() {
    run(
      async () => {
        await setSelectedMonth({ month: m.month });
        router.refresh();
      },
      { successMessage: `Bulan aktif: ${formatMonth(m.month)}` },
    );
  }
  // Only offered after a plain lock attempt fails validation — never shown
  // up front, so forcing is always a deliberate second step.
  const [offerForce, setOfferForce] = useState(false);

  async function tutupBuku(force: boolean) {
    const ok = await confirm({
      title: force ? `Kunci paksa ${formatMonth(m.month)}?` : `Tutup buku ${formatMonth(m.month)}?`,
      description: force
        ? "Ini mengabaikan pemeriksaan validasi yang gagal. Setelah dikunci, entri di bulan ini tidak bisa diposting atau dibatalkan (void) sampai bulan ini dibuka kembali."
        : "Setelah dikunci, entri di bulan ini tidak bisa diposting atau dibatalkan (void) sampai bulan ini dibuka kembali.",
      confirmLabel: force ? "Kunci Paksa" : "Kunci",
      destructive: force,
    });
    if (!ok) return;
    run(
      async () => {
        try {
          await lockMonth({ month: m.month, force });
          setOfferForce(false);
          router.refresh();
        } catch (e) {
          if (!force) setOfferForce(true);
          throw e;
        }
      },
      { successMessage: force ? "Bulan dikunci paksa" : "Bulan berhasil dikunci" },
    );
  }

  async function bukaKembali() {
    const ok = await confirm({
      title: `Buka kembali ${formatMonth(m.month)}?`,
      description: "Entri di bulan ini akan bisa diposting dan dibatalkan (void) lagi.",
      confirmLabel: "Buka Kembali",
    });
    if (!ok) return;
    run(
      async () => {
        await unlockMonth({ month: m.month });
        setOfferForce(false);
        router.refresh();
      },
      { successMessage: "Bulan dibuka kembali" },
    );
  }

  return (
    <Row
      title={formatMonth(m.month)}
      meta={
        <>
          {error ? <span className="block text-destructive">{error}</span> : null}
          <span className="mt-1 flex flex-wrap gap-1.5">
            {m.locked ? (
              <Button size="xs" variant="outline" disabled={isPending} onClick={bukaKembali}>
                Buka Kembali
              </Button>
            ) : (
              <Button size="xs" disabled={isPending} onClick={() => tutupBuku(false)}>
                Tutup Buku
              </Button>
            )}
            {!m.locked && offerForce && (
              <Button size="xs" variant="destructive" disabled={isPending} onClick={() => tutupBuku(true)}>
                Kunci Paksa
              </Button>
            )}
            {!active && (
              <Button size="xs" variant="outline" disabled={isPending} onClick={pakai}>
                Jadikan Aktif
              </Button>
            )}
          </span>
        </>
      }
    >
      <span className="flex flex-wrap justify-end gap-1.5">
        {active ? <Tag tone="ok">Aktif</Tag> : null}
        <Tag tone={m.locked ? "bad" : "acc"}>{m.locked ? "🔒 Terkunci" : "Berjalan"}</Tag>
      </span>
    </Row>
  );
}

export function BulanClient({ months, selected }: { months: Month[]; selected: string }) {
  const selectedExists = months.some((m) => m.month === selected);

  return (
    <>
      <AlertRow
        tone={selectedExists ? "info" : "warn"}
        title={`Bulan aktif: ${formatMonth(selected)}`}
        detail={
          selectedExists
            ? "Jurnal, buku kas, laporan dan pengeluaran menampilkan bulan ini."
            : "Bulan ini belum dibuat. Buat dulu supaya entri bisa diposting di sana."
        }
      />

      <p className="text-[11.5px] font-semibold leading-relaxed text-muted-foreground">
        Tutup buku mengunci sebuah bulan akuntansi supaya tidak ada entri baru yang bisa diposting
        atau dibatalkan (void) di bulan itu. Gunakan setelah laporan bulan tersebut sudah final.
      </p>

      <NewMonthForm />

      {months.length === 0 ? (
        <AlertRow tone="warn" title="Belum ada bulan yang dibuat" detail="Buat bulan baru dengan tombol di atas." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {months.map((m) => (
            <MonthCard key={m.month} m={m} active={m.month === selected} />
          ))}
        </div>
      )}

      <AlertRow
        tone="info"
        title="Menutup bulan menolak bila validasi gagal"
        detail="Kunci paksa ada, tapi sebagai langkah terpisah yang disengaja."
      />
    </>
  );
}
