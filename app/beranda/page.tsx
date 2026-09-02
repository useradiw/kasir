import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { AlertRow, BentoCard, CardLabel, MoneyHero } from "@/components/shell/ui";
import { requireAuth } from "@/lib/admin-auth";
import { getStaffSalesToday, getTodayOverview, getUnpostedDayCloses } from "@/lib/shell-queries";

/**
 * /beranda — the role-aware bento home (SPEC #1). Owner/manager see business
 * numbers and the recovery alerts; cashier/staff see their own shift. Every
 * alert carries its onward action; quick actions replace the old hub cards.
 */
export default async function BerandaPage() {
  const staff = await requireAuth();
  const isOwner = staff.role === "OWNER" || staff.role === "MANAGER" || staff.role === "DEVELOPER";
  // Narrower than isOwner above: Buku is requireOwner()-gated server-side
  // (OWNER + DEVELOPER only), so the beranda link that leads there must not
  // show for MANAGER even though MANAGER sees the rest of the owner branch.
  const canOpenBuku = staff.role === "OWNER" || staff.role === "DEVELOPER";

  const [overview, unposted] = await Promise.all([
    isOwner ? getTodayOverview() : Promise.resolve(null),
    isOwner ? getUnpostedDayCloses(1) : Promise.resolve([]),
  ]);
  const own = isOwner ? null : await getStaffSalesToday(staff.id);

  const diffPct =
    overview && overview.salesYesterday > 0
      ? Math.round(((overview.salesToday - overview.salesYesterday) / overview.salesYesterday) * 100)
      : null;

  return (
    <AppShell role={staff.role}>
      <div className="px-4 pb-1 pt-6">
        <h1 className="font-display text-[17px] font-bold">
          {isOwner ? "Selamat bekerja, " : "Hai, "}
          {staff.name}
        </h1>
        <p className="text-[11.5px] font-semibold text-muted-foreground">
          Sate Kambing Sido Mampir ·{" "}
          {new Date().toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        {isOwner && overview ? (
          <>
            <BentoCard>
              <MoneyHero
                label="Penjualan hari ini"
                value={`Rp ${overview.salesToday.toLocaleString("id-ID")}`}
                sub={
                  <>
                    {diffPct === null ? (
                      `${overview.txnsToday} transaksi`
                    ) : (
                      <span className={diffPct >= 0 ? "text-success" : "text-destructive"}>
                        {diffPct >= 0 ? "▲" : "▼"} {Math.abs(diffPct)}%
                      </span>
                    )}{" "}
                    dari kemarin · {overview.txnsToday} transaksi
                  </>
                }
              />
            </BentoCard>
            <div className="grid grid-cols-2 gap-2.5">
              <BentoCard>
                <CardLabel>Pengeluaran</CardLabel>
                <p className="font-display mt-2 text-[24px] font-bold tabular-nums">
                  {overview.expensesToday.toLocaleString("id-ID")}
                </p>
                <p className="mt-1.5 text-[11.5px] font-semibold text-muted-foreground">Hari ini</p>
              </BentoCard>
              <BentoCard>
                <CardLabel>Gaji</CardLabel>
                <p className="font-display mt-2 text-[24px] font-bold tabular-nums">
                  {overview.salaryToday.toLocaleString("id-ID")}
                </p>
                <p className="mt-1.5 text-[11.5px] font-semibold text-muted-foreground">
                  {overview.staffPresentToday} dari {overview.staffTotalToday} hadir
                </p>
              </BentoCard>
            </div>
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
            <div className="grid grid-cols-2 gap-2.5">
              {canOpenBuku ? (
                <Link
                  href="/buku"
                  className="rounded-2xl border border-border bg-card px-4 py-4 text-center active:scale-[0.98] transition-all duration-150"
                >
                  <p className="text-[14px] font-bold">Buku</p>
                  <p className="mt-0.5 text-[11.5px] font-semibold text-muted-foreground">
                    Laporan keuangan
                  </p>
                </Link>
              ) : null}
              <Link
                href="/admin"
                className={`rounded-2xl border border-border bg-card px-4 py-4 text-center active:scale-[0.98] transition-all duration-150 ${
                  canOpenBuku ? "" : "col-span-2"
                }`}
              >
                <p className="text-[14px] font-bold">Admin</p>
                <p className="mt-0.5 text-[11.5px] font-semibold text-muted-foreground">
                  Operasional toko
                </p>
              </Link>
            </div>
          </>
        ) : (
          <>
            <BentoCard>
              <MoneyHero
                label="Penjualan shift kamu hari ini"
                value={`Rp ${(own?.salesToday ?? 0).toLocaleString("id-ID")}`}
                sub={`${own?.txnsToday ?? 0} transaksi`}
              />
            </BentoCard>
            <div className="grid grid-cols-4 gap-2 rounded-2xl border border-border bg-card p-3">
              {[
                { ic: "🛒", l: "Jual", href: "/kasir" },
                { ic: "💵", l: "Kas", href: "/kas" },
                { ic: "🧾", l: "Belanja", href: "/buku/belanja" },
                { ic: "❓", l: "Petunjuk", href: "/petunjuk" },
              ].map((a) => (
                <Link
                  key={a.l}
                  href={a.href}
                  className="flex flex-col items-center gap-1.5 rounded-xl py-1 text-[11.5px] font-bold"
                >
                  <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-[15px]">
                    {a.ic}
                  </span>
                  {a.l}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
