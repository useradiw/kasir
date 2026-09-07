"use client";

/**
 * kas-cashier.tsx — the CASHIER Kas screen (docs/redesign/screens-kas.html,
 * plan-open-items.md section 3). Same in-page-state shell as kas-owner.tsx,
 * minus the owner-only pieces (edit/delete, unposted recovery) — a cashier
 * only ever manages their own today's register.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertRow, BentoCard, CardLabel, MoneyHero, Row } from "@/components/shell/ui";
import { ErrorBanner } from "@/components/admin/ui";
import { DenominationInput } from "@/components/admin/denomination-input";
import { useAdminAction } from "@/hooks/use-admin-action";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { openRegisterForStaff, closeRegisterForStaff } from "@/app/actions/cashregister";
import {
  LedgerTag,
  LockCountdown,
  MovementRow,
  PeriodSelector,
  RiwayatButton,
  SelisihTag,
  downloadDayCsv,
  useLockState,
  type Filters,
  type RegisterRowBase,
  BackLink,
  RowButton,
} from "./kas-shared";

type TodayRegister = {
  id: string;
  date: string;
  openingCash: number;
  closingCash: number | null;
  isOpen: boolean;
  createdAt: string;
  openedByName: string | null;
  closedByName: string | null;
  hasPosting: boolean | null;
  journalNumber: number | null;
} | null;

type Props = {
  cashAccountLabel: string | null;
  todayRegister: TodayRegister;
  todayCashIncome: number;
  todayExpenses: number;
  todayExpectedClosing: number;
  todayQrisIncome: number;
  todayCashTxnCount: number;
  todayMovements: RegisterRowBase["movements"];
  lockHours: number;
  registers: RegisterRowBase[];
  filters: Filters;
};

type View = { name: "main" } | { name: "riwayat" } | { name: "tutup" } | { name: "buka" } | { name: "detail"; id: string };

const LONG_DATE = () =>
  new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });

export function KasCashier({
  cashAccountLabel,
  todayRegister,
  todayCashIncome,
  todayExpenses,
  todayExpectedClosing,
  todayQrisIncome,
  todayCashTxnCount,
  todayMovements,
  lockHours,
  registers,
  filters,
}: Props) {
  const router = useRouter();
  const { isPending, run, error } = useAdminAction();
  const [view, setView] = useState<View>({ name: "main" });
  const [openingAmount, setOpeningAmount] = useState(0);
  const [closingAmount, setClosingAmount] = useState(0);
  const [showWhy, setShowWhy] = useState(false);

  const lockState = useLockState(
    todayRegister?.isOpen ? todayRegister.createdAt : undefined,
    lockHours,
  );
  const locked = lockState.locked;

  const todayAsRow: RegisterRowBase | null = todayRegister
    ? {
        id: todayRegister.id,
        date: todayRegister.date,
        openingCash: todayRegister.openingCash,
        closingCash: todayRegister.closingCash,
        cashIncome: todayCashIncome,
        qrisIncome: todayQrisIncome,
        totalExpenses: todayExpenses,
        expectedClosing: todayExpectedClosing,
        difference: todayRegister.closingCash !== null ? todayRegister.closingCash - todayExpectedClosing : null,
        cashTxnCount: todayCashTxnCount,
        movements: todayMovements,
        createdAt: todayRegister.createdAt,
        openedByName: todayRegister.openedByName,
        closedByName: todayRegister.closedByName,
        hasPosting: todayRegister.hasPosting,
        journalNumber: todayRegister.journalNumber,
      }
    : null;

  function findRow(id: string): RegisterRowBase | undefined {
    if (todayAsRow?.id === id) return todayAsRow;
    return registers.find((r) => r.id === id);
  }

  // ── Screen 5: Buka Kas ──────────────────────────────────────────────────
  if (view.name === "buka") {
    return (
      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-4">
        <BackLink label="Kas" onClick={() => setView({ name: "main" })} />
        <MoneyHero label={LONG_DATE()} value="Buka Kas" />
        <ErrorBanner error={error} />
        <form
          action={(fd) =>
            run(
              async () => {
                await openRegisterForStaff(fd);
                setView({ name: "main" });
                router.refresh();
              },
              { successMessage: "Kas dibuka" },
            )
          }
          className="flex flex-col gap-3"
        >
          <BentoCard>
            <CardLabel>Kas awal — uang kembalian</CardLabel>
            <div className="mt-2">
              <DenominationInput value={openingAmount} onChange={setOpeningAmount} />
            </div>
            <input type="hidden" name="openingCash" value={openingAmount} />
          </BentoCard>
          <Button type="submit" disabled={isPending || openingAmount === 0} className="w-full">
            Buka Kas
          </Button>
          <p className="text-center text-[11.5px] font-semibold text-muted-foreground">
            Kas awal tercatat sebagai modal kerja di laci, bukan pendapatan
          </p>
        </form>
      </div>
    );
  }

  // ── Screen 2: Tutup Kas ─────────────────────────────────────────────────
  if (view.name === "tutup" && todayRegister) {
    const selisih = closingAmount - todayExpectedClosing;
    return (
      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-4">
        <BackLink label="Kas" onClick={() => setView({ name: "main" })} />
        <MoneyHero label="Seharusnya" value={formatRupiah(todayExpectedClosing)} />
        <ErrorBanner error={error} />
        {locked ? (
          <LockCountdown remaining={lockState.remaining} />
        ) : (
          <form
            action={(fd) =>
              run(
                async () => {
                  await closeRegisterForStaff(fd);
                  setView({ name: "main" });
                  router.refresh();
                },
                { successMessage: "Kas ditutup" },
              )
            }
            className="flex flex-col gap-3"
          >
            <BentoCard>
              <CardLabel>Hitung uang di laci</CardLabel>
              <div className="mt-2">
                <DenominationInput value={closingAmount} onChange={setClosingAmount} />
              </div>
              <input type="hidden" name="closingCash" value={closingAmount} />
            </BentoCard>

            {closingAmount > 0 ? (
              <BentoCard className={selisih === 0 ? "" : selisih < 0 ? "border-destructive/35 bg-destructive-soft" : "border-primary/35 bg-primary-soft"}>
                <div className="flex items-center justify-between">
                  <CardLabel>Selisih {selisih === 0 ? "" : selisih < 0 ? "— kurang" : "— lebih"}</CardLabel>
                  <span className="font-display text-[15px] font-bold tabular-nums">
                    {formatRupiah(Math.abs(selisih))}
                  </span>
                </div>
              </BentoCard>
            ) : null}

            <AlertRow
              tone="warn"
              title={
                <>
                  Selisih dicatat otomatis ke <b>Expenses:SelisihKas</b>
                </>
              }
              detail={
                showWhy
                  ? "Kas ditutup tetap jalan walau bulan terkunci — kalau bulan itu sudah dikunci, entrinya menyusul begitu dibuka lagi atau dicatat manual oleh owner. Selisih tidak pernah membuat kas gagal ditutup."
                  : "Kas ditutup tetap jalan walau bulan terkunci — catatan menyusul."
              }
              actionLabel="Kenapa?"
              onAction={() => setShowWhy((s) => !s)}
            />

            <Button type="submit" disabled={isPending || closingAmount === 0} className="w-full">
              Tutup Kas
            </Button>
            <p className="text-center text-[11.5px] font-semibold text-muted-foreground">
              Setelah ditutup, penjualan hari ini tercatat ke buku besar
            </p>
          </form>
        )}
      </div>
    );
  }

  // ── Screen 3: Riwayat ───────────────────────────────────────────────────
  if (view.name === "riwayat") {
    return (
      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-4">
        <div className="flex items-center justify-between">
          <BackLink label="Kas" onClick={() => setView({ name: "main" })} />
          <PeriodSelector filters={filters} />
        </div>
        <div>
          <h1 className="font-display text-[17px] font-bold">Kas · Riwayat</h1>
          <p className="text-[11.5px] font-semibold text-muted-foreground">{registers.length} hari</p>
        </div>
        {registers.length === 0 ? (
          <AlertRow tone="info" title="Belum ada data kas" detail="Riwayat kas akan muncul di sini." />
        ) : (
          <div className="flex flex-col gap-2.5">
            {registers.map((r) => (
              <RowButton key={r.id} onClick={() => setView({ name: "detail", id: r.id })}>
                <Row
                  title={formatDateTime(r.date, "long")}
                  meta={
                    <>
                      Tunai {formatRupiah(r.cashIncome)} · QRIS {formatRupiah(r.qrisIncome)}
                      {r.closingCash !== null ? ` · ditutup ${formatDateTime(r.date, "short")}` : ""}
                      <span className="mt-1 block">
                        <LedgerTag hasPosting={r.hasPosting} journalNumber={r.journalNumber} />
                      </span>
                    </>
                  }
                >
                  <div className="flex flex-col items-end gap-1">
                    <span className="tabular-nums text-[13.5px] font-bold">
                      {r.closingCash !== null ? formatRupiah(r.closingCash) : "Belum ditutup"}
                    </span>
                    <SelisihTag difference={r.difference} />
                  </div>
                </Row>
              </RowButton>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Screen 4: Detail hari ───────────────────────────────────────────────
  if (view.name === "detail") {
    const r = findRow(view.id);
    if (!r) {
      return (
        <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-4">
          <BackLink label="Riwayat" onClick={() => setView({ name: "riwayat" })} />
          <AlertRow tone="warn" title="Data tidak ditemukan" />
        </div>
      );
    }
    const masuk = r.movements.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0);
    const keluar = r.movements.filter((m) => m.amount < 0).reduce((s, m) => s + m.amount, 0);
    return (
      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-4">
        <BackLink
          label={todayAsRow?.id === r.id ? "Kas" : "Riwayat"}
          onClick={() => setView(todayAsRow?.id === r.id ? { name: "main" } : { name: "riwayat" })}
        />
        <MoneyHero label={r.openedByName ? `Dibuka · ${r.openedByName}` : "Kas"} value={formatDateTime(r.date, "long")} />

        <BentoCard>
          <CardLabel>Rincian kas</CardLabel>
          <div className="mt-2.5 flex flex-col gap-2 text-[13px] font-semibold">
            <div className="flex justify-between"><span className="text-muted-foreground">Kas awal</span><span className="tabular-nums">{formatRupiah(r.openingCash)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Penjualan tunai</span><span className="tabular-nums">{formatRupiah(r.cashIncome)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Transfer / modal masuk</span><span className="tabular-nums">{formatRupiah(masuk)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Pengeluaran & transfer keluar</span><span className="tabular-nums text-destructive">−{formatRupiah(Math.abs(keluar))}</span></div>
            <div className="flex justify-between border-t border-border pt-2 font-bold"><span>Seharusnya</span><span className="tabular-nums">{formatRupiah(r.expectedClosing)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Dihitung riil</span><span className="tabular-nums">{r.closingCash !== null ? formatRupiah(r.closingCash) : "—"}</span></div>
            <div className="flex justify-between border-t border-border pt-2 font-bold"><span>Selisih</span><span className="tabular-nums">{r.difference !== null ? formatRupiah(r.difference) : "—"}</span></div>
          </div>
        </BentoCard>

        {r.hasPosting === false ? (
          <AlertRow tone="bad" title="Belum tercatat ke buku besar" detail="Kemungkinan bulan sedang terkunci saat kas ditutup — owner bisa mencatatnya kembali." />
        ) : null}

        {/* No "Lihat di Buku Kas" link here, unlike kas-owner.tsx: /buku/kas is
            requireCan("buku.read")-gated, and this component only ever renders for a
            CASHIER. Linking there would trade a 404 for a permission error. */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => downloadDayCsv(r)}>
            Unduh CSV
          </Button>
        </div>
      </div>
    );
  }

  // ── Screen 1: main ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[17px] font-bold">Kas</h1>
          <p className="text-[11.5px] font-semibold text-muted-foreground">
            {cashAccountLabel ? `${cashAccountLabel} · ` : ""}
            {LONG_DATE()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RiwayatButton onClick={() => setView({ name: "riwayat" })} />
          <PeriodSelector filters={filters} />
        </div>
      </div>

      <ErrorBanner error={error} />

      <div className="grid grid-cols-2 gap-2.5">
        <BentoCard className="col-span-2">
          <MoneyHero label="Seharusnya di laci" value={formatRupiah(todayExpectedClosing)} sub="kas awal + penjualan tunai + transfer masuk − keluar" />
        </BentoCard>
        <BentoCard>
          <CardLabel>Kas awal</CardLabel>
          <p className="font-display mt-2 text-[22px] font-bold tabular-nums">{formatRupiah(todayRegister?.openingCash ?? 0)}</p>
          <p className="mt-1 text-[11.5px] font-semibold text-muted-foreground">
            {todayRegister ? `${formatDateTime(todayRegister.createdAt, "short")} · ${todayRegister.openedByName ?? "—"}` : "—"}
          </p>
        </BentoCard>
        <BentoCard>
          <CardLabel>Tunai masuk</CardLabel>
          <p className="font-display mt-2 text-[22px] font-bold tabular-nums text-success">{formatRupiah(todayCashIncome)}</p>
          <p className="mt-1 text-[11.5px] font-semibold text-muted-foreground">{todayCashTxnCount} transaksi</p>
        </BentoCard>
      </div>

      {todayMovements.length > 0 ? (
        <div className="flex flex-col gap-2">
          {todayMovements.map((m) => (
            <MovementRow key={m.entryId} movement={m} />
          ))}
        </div>
      ) : null}

      {todayRegister === null ? (
        <Button className="w-full" onClick={() => setView({ name: "buka" })}>
          Buka Kas
        </Button>
      ) : todayRegister.isOpen ? (
        locked ? (
          <LockCountdown remaining={lockState.remaining} />
        ) : (
          <Button className="w-full" onClick={() => setView({ name: "tutup" })}>
            Tutup Kas
          </Button>
        )
      ) : (
        <div className="flex flex-col gap-2">
          <Row title="Kas hari ini sudah ditutup" meta={<LedgerTag hasPosting={todayRegister.hasPosting} journalNumber={todayRegister.journalNumber} />}>
            <SelisihTag difference={todayAsRow?.difference ?? null} />
          </Row>
          <Button variant="outline" className="w-full" onClick={() => setView({ name: "detail", id: todayRegister.id })}>
            Lihat detail
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" render={<Link href="/buku/belanja" />}>
          ＋ Catat Uang Masuk/Keluar
        </Button>
      </div>
    </div>
  );
}
