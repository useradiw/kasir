"use client";

/**
 * kas-shared.tsx — pieces shared by kas-owner.tsx and kas-cashier.tsx
 * (docs/redesign/plan-open-items.md section 3 / /kas Phase 3).
 *
 * Types mirror the shape getCashRegisterData / getCashRegisterDataForStaff
 * return (app/actions/admin/queries/cash-register-queries.ts and
 * app/actions/cashregister.ts) — kept local rather than imported from those
 * "use server" files, since these are client components.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag } from "@/components/shell/ui";
import { formatRupiah, formatDateTime } from "@/lib/format";

// ─── Shared types ────────────────────────────────────────────────────────

export type CashMovementLine = {
  dateKey: string;
  narration: string;
  amount: number;
  sourceType: string | null;
  entryNumber: number | null;
  entryId: string;
  postedAt: string | null;
};

export type RegisterRowBase = {
  id: string;
  date: string;
  openingCash: number;
  closingCash: number | null;
  cashIncome: number;
  qrisIncome: number;
  totalExpenses: number;
  expectedClosing: number;
  difference: number | null;
  cashTxnCount: number;
  movements: CashMovementLine[];
  createdAt: string;
  openedByName: string | null;
  closedByName: string | null;
  hasPosting: boolean | null;
  journalNumber: number | null;
};

export type Filters = { from: string; to: string };

// ─── Lock countdown — copied across from the old cashregister-client.tsx,
// not re-derived, so the timing behaviour is exactly what shipped before. ──

export function useLockState(createdAt: string | undefined, lockHours: number) {
  const calcRemaining = useCallback(() => {
    if (!createdAt) return { locked: false, remaining: "" };
    const lockExpiry = new Date(new Date(createdAt).getTime() + lockHours * 60 * 60 * 1000);
    const diff = lockExpiry.getTime() - Date.now();
    if (diff <= 0) return { locked: false, remaining: "" };
    const h = Math.floor(diff / (60 * 60 * 1000));
    const m = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    const s = Math.floor((diff % (60 * 1000)) / 1000);
    return { locked: true, remaining: `${h} jam ${m} menit ${s} detik` };
  }, [createdAt, lockHours]);

  const [state, setState] = useState(calcRemaining);

  useEffect(() => {
    const interval = setInterval(() => setState(calcRemaining()), 1000);
    return () => clearInterval(interval);
  }, [calcRemaining]);

  return state;
}

export function LockCountdown({ remaining }: { remaining: string }) {
  if (!remaining) return null;
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3.5 text-[12.5px]">
      <Lock className="size-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="font-bold">Kas terkunci</p>
        <p className="font-semibold text-muted-foreground">
          Bisa ditutup dalam <span className="tabular-nums">{remaining}</span>
        </p>
      </div>
    </div>
  );
}

// ─── Tags ────────────────────────────────────────────────────────────────

export function LedgerTag({ hasPosting, journalNumber }: { hasPosting: boolean | null; journalNumber: number | null }) {
  if (hasPosting === null) return null;
  return hasPosting ? (
    <Tag tone="ok">{journalNumber ? `Tercatat · #${String(journalNumber).padStart(4, "0")}` : "Tercatat"}</Tag>
  ) : (
    <Tag tone="bad">Belum tercatat ke buku besar</Tag>
  );
}

export function SelisihTag({ difference }: { difference: number | null }) {
  if (difference === null) return null;
  if (difference === 0) return <Tag tone="ok">Seimbang</Tag>;
  if (difference < 0) return <Tag tone="warn">Kurang {formatRupiah(Math.abs(difference))}</Tag>;
  return <Tag tone="acc">Lebih {formatRupiah(difference)}</Tag>;
}

// ─── Movement row ────────────────────────────────────────────────────────

export function MovementRow({ movement }: { movement: CashMovementLine }) {
  const time = movement.postedAt
    ? new Date(movement.postedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-bold leading-snug">{movement.narration}</p>
        <p className="mt-0.5 text-[11.5px] font-semibold leading-snug text-muted-foreground">
          {[time, movement.sourceType ?? "manual"].filter(Boolean).join(" · ")}
        </p>
      </div>
      <span className={`shrink-0 text-[13.5px] font-bold tabular-nums ${movement.amount < 0 ? "text-destructive" : "text-success"}`}>
        {movement.amount < 0 ? "−" : "+"}
        {formatRupiah(Math.abs(movement.amount))}
      </span>
    </div>
  );
}

// ─── Period selector — replaces the old Dari/Sampai + Filter/Reset pair.
// Presets plus an explicit range, all writing ?from=/?to= on /kas. ────────

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function presetRange(kind: "today" | "week" | "month" | "year"): Filters {
  const now = new Date();
  if (kind === "today") {
    const k = toKey(now);
    return { from: k, to: k };
  }
  if (kind === "week") {
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    return { from: toKey(monday), to: toKey(sunday) };
  }
  if (kind === "month") {
    return {
      from: toKey(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: toKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }
  return {
    from: toKey(new Date(now.getFullYear(), 0, 1)),
    to: toKey(new Date(now.getFullYear(), 11, 31)),
  };
}

export function PeriodSelector({ filters }: { filters: Filters }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState(filters);

  function apply(next: Filters) {
    const params = new URLSearchParams();
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
    router.push(`/kas${params.toString() ? `?${params.toString()}` : ""}`);
    setOpen(false);
  }

  const label = filters.from || filters.to ? `${filters.from || "…"} – ${filters.to || "…"}` : "Semua";

  return (
    <div className="relative">
      <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
        {label} ▾
      </Button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-border bg-card p-3 shadow-lg">
          <div className="grid grid-cols-2 gap-1.5">
            <Button size="xs" variant="ghost" onClick={() => apply(presetRange("today"))}>
              Hari ini
            </Button>
            <Button size="xs" variant="ghost" onClick={() => apply(presetRange("week"))}>
              Minggu ini
            </Button>
            <Button size="xs" variant="ghost" onClick={() => apply(presetRange("month"))}>
              Bulan ini
            </Button>
            <Button size="xs" variant="ghost" onClick={() => apply(presetRange("year"))}>
              Tahun ini
            </Button>
          </div>
          <div className="mt-2.5 flex flex-col gap-1.5 border-t border-border pt-2.5">
            <Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
            <Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
            <div className="flex gap-1.5">
              <Button size="xs" className="flex-1" onClick={() => apply(range)}>
                Terapkan
              </Button>
              <Button size="xs" variant="ghost" onClick={() => apply({ from: "", to: "" })}>
                Reset
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function RiwayatButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="icon-sm" variant="outline" onClick={onClick} aria-label="Riwayat">
      <History className="size-4" />
    </Button>
  );
}

// ─── CSV export — client-side Blob download built from props already in
// hand (Screen 4). No new query, no server round-trip. ────────────────────

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function downloadDayCsv(register: RegisterRowBase) {
  const rows: string[][] = [
    ["Tanggal", formatDateTime(register.date, "long")],
    [],
    ["Uraian", "Jumlah"],
    ["Kas awal", String(register.openingCash)],
    ["Penjualan tunai", String(register.cashIncome)],
    ["Transfer / modal masuk & pengeluaran", ""],
    ...register.movements.map((m) => [m.narration, String(m.amount)]),
    [],
    ["Seharusnya", String(register.expectedClosing)],
    ["Dihitung riil", String(register.closingCash ?? 0)],
    ["Selisih", String(register.difference ?? 0)],
  ];
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kas-${register.date.slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Back affordance for the in-page states (screens 2, 4 and 5 of
 * screens-kas.html). It is a <Button>, never a raw <button> — the design
 * system's focus ring, active state and tap target come with it.
 */
export function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={onClick}
      className="w-fit px-0 text-[12.5px] font-bold text-muted-foreground"
    >
      ⟵ {label}
    </Button>
  );
}

/** Full-width tappable history row — the same Button, reset to a block container. */
export function RowButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className="block h-auto w-full rounded-2xl p-0 text-left transition-all duration-150 active:scale-[0.98]"
    >
      {children}
    </Button>
  );
}
