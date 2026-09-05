import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { AlertRow, BentoCard, CardLabel, Tag } from "@/components/shell/ui";
import { requireOwner } from "@/lib/admin-auth";
import { getSelectedMonth } from "@/lib/keuangan-month";
import { buildLaporanKeuangan } from "@/lib/laporan-keuangan";
import {
  getBukuSetupStatus,
  getUnpostedDayCloses,
  setupSteps,
} from "@/lib/shell-queries";

/**
 * /buku — the owner's accounting glance (SPEC #7): laba bersih as the hero,
 * setup checklist while incomplete, and the recovery alerts surfaced here
 * instead of buried one level deep.
 */
export default async function BukuPage() {
  const staff = await requireOwner();
  const month = await getSelectedMonth();

  const [laporan, setup, unposted] = await Promise.all([
    buildLaporanKeuangan(month),
    getBukuSetupStatus(),
    getUnpostedDayCloses(2),
  ]);

  const steps = setupSteps(setup);
  const remaining = steps.filter((s) => !s.done).length;
  const labaBersih = Number(laporan.labaRugi.laba_bersih ?? 0);
  const pendapatan = Number(laporan.labaRugi.pendapatan.total ?? 0);
  const hpp = Number(laporan.labaRugi.hpp.total ?? 0);
  const beban = Number(laporan.labaRugi.biaya_operasional.total ?? 0);
  const max = Math.max(pendapatan, hpp, beban, 1);

  return (
    <AppShell role={staff.role}>
      <div className="px-4 pb-1 pt-5">
        <h1 className="font-display text-[17px] font-bold leading-tight">Laporan Keuangan</h1>
        <p className="text-[11.5px] font-semibold text-muted-foreground">Pembukuan toko</p>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        {remaining > 0 ? (
          <AlertRow
            tone="warn"
            title={`Setup buku belum lengkap — ${remaining} langkah tersisa`}
            detail={steps.find((s) => !s.done)?.detail}
            actionLabel="Lanjut"
            actionHref="/buku/setup"
          />
        ) : null}

        <BentoCard>
          <div className="flex items-center justify-between">
            <CardLabel>Laba bersih · {month}</CardLabel>
            {laporan.validasi ? <Tag tone="ok">✓ Validasi</Tag> : null}
          </div>
          <p className="font-display mt-2 text-[38px] font-bold leading-none tracking-tight tabular-nums">
            Rp {labaBersih.toLocaleString("id-ID")}
          </p>
          <p className="mt-1.5 text-[11.5px] font-semibold text-muted-foreground">
            dari {pendapatan.toLocaleString("id-ID")} pendapatan
          </p>
          <div className="mt-4 flex flex-col gap-2.5">
            {[
              { l: "Pendapatan", v: pendapatan, w: (pendapatan / max) * 100, dim: false },
              { l: "HPP", v: hpp, w: (hpp / max) * 100, dim: true },
              { l: "Beban", v: beban, w: (beban / max) * 100, dim: true },
            ].map((r) => (
              <div key={r.l} className="flex items-center gap-2.5">
                <span className="w-20 text-xs font-semibold text-muted-foreground">{r.l}</span>
                <span className="h-[7px] flex-1 overflow-hidden rounded-full border border-border bg-card-2">
                  <span
                    className={`block h-full rounded-full ${r.dim ? "bg-primary/45" : "bg-primary"}`}
                    style={{ width: `${r.w}%` }}
                  />
                </span>
                <span className="font-display min-w-[72px] text-right text-[12.5px] font-bold tabular-nums">
                  {r.v.toLocaleString("id-ID")}
                </span>
              </div>
            ))}
          </div>
        </BentoCard>

        {unposted.map((u) => (
          <AlertRow
            key={u.id}
            tone="warn"
            title={`${u.date.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} belum tercatat ke buku besar`}
            detail={u.reason ?? "Belum masuk ke jurnal — buka Kas untuk mencatatnya."}
            actionLabel="Catat"
            actionHref="/kas"
          />
        ))}

        <div className="grid grid-cols-4 gap-2 rounded-2xl border border-border bg-card p-3">
          {[
            { ic: "📊", l: "Laporan", href: "/buku/laporan" },
            { ic: "📜", l: "Jurnal", href: "/buku/jurnal" },
            { ic: "💰", l: "Buku Kas", href: "/buku/kas" },
            { ic: "🧾", l: "Belanja", href: "/buku/pengeluaran" },
          ].map((a) => (
            <Link
              key={a.l}
              href={a.href}
              className="cursor-pointer flex flex-col items-center gap-1.5 rounded-xl py-1 text-[11.5px] font-bold active:scale-[0.98] transition-all duration-150"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-[15px]">
                {a.ic}
              </span>
              {a.l}
            </Link>
          ))}
        </div>

        {/* Pengaturan — the settings tier of Buku. These five screens used to be
            reachable ONLY from the setup checklist and from empty-state warnings
            ("Belum ada akun kas..."), so a shop that finished setup correctly
            could no longer reach any of them: the alerts that linked there stop
            rendering once the thing they warn about is fixed. /buku/kategori had
            no inbound link at all. Found 2026-09-05. These rows are
            UNCONDITIONAL on purpose — do not wrap them in a setup check. */}
        <div className="flex flex-col gap-2.5">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Pengaturan
          </p>
          {[
            { href: "/buku/bulan", label: "Bulan", detail: "Bulan aktif, tutup buku & kunci periode" },
            { href: "/buku/akun", label: "Akun Kas", detail: "Daftar akun kas dan bank" },
            { href: "/buku/akun-penjualan", label: "Akun Penjualan", detail: "Petakan tunai, elektronik dan online" },
            { href: "/buku/kategori", label: "Kategori Pengeluaran", detail: "Kelompok biaya untuk tiap pengeluaran" },
            { href: "/buku/setup", label: "Setup Buku", detail: "Langkah awal pembukuan" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="cursor-pointer flex items-center rounded-2xl border border-border bg-card px-4 py-4 active:scale-[0.99] transition-all duration-150"
            >
              <div>
                <p className="text-[14px] font-bold">{l.label}</p>
                <p className="mt-0.5 text-[11.5px] font-semibold text-muted-foreground">{l.detail}</p>
              </div>
              <span className="ml-auto text-muted-foreground">→</span>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
