"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/shared/badge";
import { ErrorBanner } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { lockMonth, unlockMonth } from "@/app/actions/admin/keuangan";
import { formatMonth } from "../_components/month-picker";

type Month = { month: string; locked: boolean };

function MonthCard({ m }: { m: Month }) {
  const router = useRouter();
  const { isPending, run, error } = useAdminAction();
  const confirm = useConfirm();
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
    <div className="space-y-2 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{formatMonth(m.month)}</p>
        <Badge className={m.locked ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}>
          {m.locked ? "Terkunci" : "Terbuka"}
        </Badge>
      </div>

      <ErrorBanner error={error} />

      <div className="flex flex-wrap gap-2">
        {m.locked ? (
          <Button size="sm" variant="outline" disabled={isPending} onClick={bukaKembali}>
            Buka Kembali
          </Button>
        ) : (
          <Button size="sm" disabled={isPending} onClick={() => tutupBuku(false)}>
            Tutup Buku
          </Button>
        )}
        {!m.locked && offerForce && (
          <Button size="sm" variant="destructive" disabled={isPending} onClick={() => tutupBuku(true)}>
            Kunci Paksa (Abaikan Pemeriksaan)
          </Button>
        )}
      </div>
    </div>
  );
}

export function BulanClient({ months }: { months: Month[] }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Tutup buku mengunci sebuah bulan akuntansi supaya tidak ada entri baru yang bisa diposting
        atau dibatalkan (void) di bulan itu. Gunakan setelah laporan bulan tersebut sudah final —
        untuk membuat bulan baru, gunakan tombol &quot;+ Bulan&quot; di pemilih bulan di atas.
      </p>

      {months.length === 0 ? (
        <div className="rounded-lg bg-warning/10 p-3 text-xs text-warning-foreground">
          Belum ada bulan yang dibuat. Buat bulan baru lewat pemilih bulan di atas (tombol
          &quot;+ Bulan&quot;).
        </div>
      ) : (
        <div className="space-y-3">
          {months.map((m) => (
            <MonthCard key={m.month} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}
