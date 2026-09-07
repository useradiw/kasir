import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { SetupStep } from "@/components/shell/setup-step";
import { requireCan } from "@/lib/admin-auth";
import { getBukuSetupStatus, setupSteps } from "@/lib/shell-queries";

/**
 * /buku/setup — the guided setup checklist (SPEC #9). Replaces the scattered
 * seed buttons: the blocking steps render in their required order, each with
 * its inline action or onward link. Shown first from /buku while incomplete.
 */
export default async function BukuSetupPage() {
  const staff = await requireCan("buku.read");
  const status = await getBukuSetupStatus();
  const steps = setupSteps(status);

  const actionByStep: Record<string, { action?: "seed-accounts" | "seed-categories"; href?: string }> = {
    "Isi akun default": { action: "seed-accounts" },
    "Buat akun kas": { href: "/buku/akun" },
    "Petakan akun penjualan": { href: "/buku/akun-penjualan" },
    "Isi kategori pengeluaran": { action: "seed-categories" },
  };

  const doneCount = steps.filter((s) => s.done).length;
  const nextLabel = steps.find((s) => !s.done)?.label;

  return (
    <AppShell role={staff.role}>
      <div className="px-4 pb-1 pt-5">
        <Link href="/buku" className="cursor-pointer text-[12.5px] font-bold text-muted-foreground">
          ← Buku
        </Link>
        <h1 className="font-display mt-2 text-[17px] font-bold">Persiapan Buku</h1>
        <p className="text-[11.5px] font-semibold text-muted-foreground">
          {doneCount}/{steps.length} selesai — sebelum pencatatan bisa jalan
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        <div className="rounded-2xl border border-border bg-card">
          {steps.map((s, i) => {
            const cfg = actionByStep[s.label] ?? {};
            return (
              <SetupStep
                key={s.label}
                index={i + 1}
                done={s.done}
                label={s.label}
                detail={s.detail}
                action={cfg.action}
                actionHref={cfg.href}
                isNext={!s.done && steps.findIndex((x) => !x.done) === i}
              />
            );
          })}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-semibold leading-relaxed text-muted-foreground">
            Urutan wajib: akun dulu, lalu akun kas, lalu pemetaan kanal, lalu
            kategori. Setelah semuanya selesai, buat bulan pertama di{" "}
            <Link href="/buku/bulan" className="cursor-pointer font-bold text-primary">
              Bulan
            </Link>
            , hitung uang riil, dan catat lewat{" "}
            <Link href="/buku/pengeluaran?jenis=saldo-awal" className="cursor-pointer font-bold text-primary">
              Saldo Awal
            </Link>
            . Tidak ada apa pun yang tercatat ke buku besar sebelum langkah 3
            lengkap.
          </p>
        </div>

        {nextLabel ? (
          <p className="text-center text-[11.5px] font-semibold text-muted-foreground">
            Langkah berikutnya: {nextLabel}
          </p>
        ) : (
          <Link
            href="/buku"
            className="cursor-pointer rounded-2xl bg-primary py-4 text-center text-[15px] font-extrabold text-primary-foreground"
          >
            Setup lengkap — kembali ke Buku
          </Link>
        )}
      </div>
    </AppShell>
  );
}
