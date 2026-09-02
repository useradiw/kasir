"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { BentoCard } from "@/components/shell/ui";
import { formatRupiah } from "@/lib/format";
import type { MenuPerformanceData, MenuPerformanceRow } from "@/app/actions/admin/queries";

type Period = "daily" | "weekly" | "monthly" | "yearly";

const PERIOD_LABELS: Record<Period, string> = {
  daily: "Harian",
  weekly: "Mingguan",
  monthly: "Bulanan",
  yearly: "Tahunan",
};

type SortKey = "revenue" | "qtySold";

// Declared outside component to avoid react-hooks/static-components warning
function SortBtn({
  col,
  label,
  sortKey,
  sortAsc,
  onSort,
}: {
  col: SortKey;
  label: string;
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (col: SortKey) => void;
}) {
  return (
    <button
      onClick={() => onSort(col)}
      className={`flex items-center gap-1 hover:text-primary transition-colors ${sortKey === col ? "text-primary font-semibold" : ""}`}
    >
      {label}
      <span className="text-xs">{sortKey === col ? (sortAsc ? "↑" : "↓") : "↕"}</span>
    </button>
  );
}

export function MenuPerformanceClient({
  data,
  currentPeriod,
  currentDate,
}: {
  data: MenuPerformanceData;
  currentPeriod: Period;
  currentDate: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");

  function navigate(period: Period, date: string) {
    router.push(`${pathname}?period=${period}&date=${date}`);
  }

  function prevDate() {
    const d = new Date(currentDate + "T00:00:00");
    if (currentPeriod === "daily") d.setDate(d.getDate() - 1);
    else if (currentPeriod === "weekly") d.setDate(d.getDate() - 7);
    else if (currentPeriod === "monthly") d.setMonth(d.getMonth() - 1);
    else d.setFullYear(d.getFullYear() - 1);
    navigate(currentPeriod, d.toISOString().slice(0, 10));
  }

  function nextDate() {
    const d = new Date(currentDate + "T00:00:00");
    if (currentPeriod === "daily") d.setDate(d.getDate() + 1);
    else if (currentPeriod === "weekly") d.setDate(d.getDate() + 7);
    else if (currentPeriod === "monthly") d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
    navigate(currentPeriod, d.toISOString().slice(0, 10));
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(false); }
  }

  const sorted = useMemo(() => {
    let rows = [...data.rows];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    }
    rows.sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return rows;
  }, [data.rows, sortKey, sortAsc, search]);

  const { totals } = data;

  const sortBtnProps = { sortKey, sortAsc, onSort: handleSort };

  return (
    <>
      {/* Period controls */}
      <BentoCard className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {(["daily", "weekly", "monthly", "yearly"] as Period[]).map((p) => (
            <Button
              key={p}
              variant={currentPeriod === p ? "default" : "outline"}
              size="sm"
              onClick={() => navigate(p, currentDate)}
            >
              {PERIOD_LABELS[p]}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon-sm" onClick={prevDate} aria-label="Periode sebelumnya">‹</Button>
          <input
            type="date"
            value={currentDate}
            onChange={(e) => e.target.value && navigate(currentPeriod, e.target.value)}
            className="h-9 rounded-xl border border-border bg-card-2 px-3 text-[13px]"
          />
          <Button variant="outline" size="icon-sm" onClick={nextDate} aria-label="Periode berikutnya">›</Button>
        </div>
      </BentoCard>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <BentoCard>
          <p className="text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">Total Penjualan</p>
          <p className="font-display mt-1 text-[17px] font-bold tabular-nums">{formatRupiah(totals.revenue)}</p>
          <p className="mt-0.5 text-[11.5px] font-semibold text-muted-foreground tabular-nums">{totals.qtySold} item terjual</p>
        </BentoCard>
        <BentoCard>
          <p className="text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">Jumlah Menu Terjual</p>
          <p className="font-display mt-1 text-[17px] font-bold tabular-nums">{data.rows.length}</p>
        </BentoCard>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Cari nama menu..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-9 w-full rounded-xl border border-border bg-card-2 px-3 text-[13px]"
      />

      {/* Table */}
      {sorted.length === 0 ? (
        <p className="py-12 text-center text-[12.5px] font-semibold text-muted-foreground">
          Tidak ada data untuk periode ini.
        </p>
      ) : (
        <BentoCard className="overflow-x-auto">
          <table className="w-full min-w-100 text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 pr-3 font-bold">Menu</th>
                <th className="pb-2 pr-3 text-right font-bold">
                  <SortBtn col="qtySold" label="Terjual" {...sortBtnProps} />
                </th>
                <th className="pb-2 text-right font-bold">
                  <SortBtn col="revenue" label="Pendapatan" {...sortBtnProps} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((row) => (
                <PerformanceRow key={row.key} row={row} />
              ))}
            </tbody>
            <tfoot className="border-t border-border font-bold">
              <tr>
                <td className="pt-2 pr-3">Total</td>
                <td className="pt-2 pr-3 text-right tabular-nums">{totals.qtySold}</td>
                <td className="pt-2 text-right tabular-nums">{formatRupiah(totals.revenue)}</td>
              </tr>
            </tfoot>
          </table>
        </BentoCard>
      )}
    </>
  );
}

function PerformanceRow({ row }: { row: MenuPerformanceRow }) {
  return (
    <tr>
      <td className="py-2 pr-3">
        <span className="font-semibold">{row.name}</span>
        {row.variantLabel && (
          <span className="ml-1 text-[11px] text-muted-foreground">({row.variantLabel})</span>
        )}
      </td>
      <td className="py-2 pr-3 text-right tabular-nums">{row.qtySold}</td>
      <td className="py-2 text-right tabular-nums">{formatRupiah(row.revenue)}</td>
    </tr>
  );
}
