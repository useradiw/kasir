"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AdminPageHeader } from "@/components/admin/ui";
import { formatRupiah } from "@/lib/format";
import type { MenuPerformanceData, MenuPerformanceRow } from "@/app/actions/admin/queries";

type Period = "daily" | "weekly" | "monthly" | "yearly";

const PERIOD_LABELS: Record<Period, string> = {
  daily: "Harian",
  weekly: "Mingguan",
  monthly: "Bulanan",
  yearly: "Tahunan",
};

function marginColor(pct: number | null): string {
  if (pct === null) return "text-muted-foreground";
  if (pct >= 60) return "text-green-600 dark:text-green-400";
  if (pct >= 30) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

type SortKey = "revenue" | "qtySold" | "totalCogs" | "grossProfit" | "marginPct" | "cogsPerPortion";

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
  const cogsRows = data.rows.filter((r) => r.hasRecipe);
  const noRecipeRevenue = data.rows.filter((r) => !r.hasRecipe).reduce((s, r) => s + r.revenue, 0);

  const sortBtnProps = { sortKey, sortAsc, onSort: handleSort };

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Performa Menu">
        <span className="text-sm text-muted-foreground">Pendapatan, HPP, dan margin per menu item</span>
      </AdminPageHeader>

      {/* Period controls */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["daily", "weekly", "monthly", "yearly"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => navigate(p, currentDate)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  currentPeriod === p
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground hover:bg-primary/5"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={prevDate} className="px-2 py-1 rounded bg-muted text-sm hover:bg-muted/80">‹</button>
            <input
              type="date"
              value={currentDate}
              onChange={(e) => e.target.value && navigate(currentPeriod, e.target.value)}
              className="h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm"
            />
            <button onClick={nextDate} className="px-2 py-1 rounded bg-muted text-sm hover:bg-muted/80">›</button>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Penjualan</p>
            <p className="text-lg font-semibold">{formatRupiah(totals.revenue)}</p>
            <p className="text-xs text-muted-foreground">{totals.qtySold} item terjual</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total HPP</p>
            <p className="text-lg font-semibold">{formatRupiah(totals.totalCogs)}</p>
            {noRecipeRevenue > 0 && (
              <p className="text-xs text-muted-foreground">{formatRupiah(noRecipeRevenue)} tanpa resep</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Laba Kotor</p>
            <p className={`text-lg font-semibold ${totals.grossProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {formatRupiah(totals.grossProfit)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Margin Kotor</p>
            <p className={`text-lg font-semibold ${marginColor(totals.marginPct)}`}>
              {totals.marginPct !== null ? `${totals.marginPct}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">{cogsRows.length} item dengan resep</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Cari nama menu..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm"
      />

      {/* Table */}
      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            Tidak ada data untuk periode ini.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4 overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-3">Menu</th>
                  <th className="pb-2 pr-3 text-right">
                    <SortBtn col="qtySold" label="Terjual" {...sortBtnProps} />
                  </th>
                  <th className="pb-2 pr-3 text-right">
                    <SortBtn col="revenue" label="Pendapatan" {...sortBtnProps} />
                  </th>
                  <th className="pb-2 pr-3 text-right">
                    <SortBtn col="cogsPerPortion" label="HPP/Porsi" {...sortBtnProps} />
                  </th>
                  <th className="pb-2 pr-3 text-right">
                    <SortBtn col="totalCogs" label="Total HPP" {...sortBtnProps} />
                  </th>
                  <th className="pb-2 pr-3 text-right">
                    <SortBtn col="grossProfit" label="Laba Kotor" {...sortBtnProps} />
                  </th>
                  <th className="pb-2 text-right">
                    <SortBtn col="marginPct" label="Margin" {...sortBtnProps} />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map((row) => (
                  <PerformanceRow key={row.key} row={row} />
                ))}
              </tbody>
              <tfoot className="border-t font-semibold">
                <tr>
                  <td className="pt-2 pr-3">Total</td>
                  <td className="pt-2 pr-3 text-right">{totals.qtySold}</td>
                  <td className="pt-2 pr-3 text-right">{formatRupiah(totals.revenue)}</td>
                  <td className="pt-2 pr-3 text-right">—</td>
                  <td className="pt-2 pr-3 text-right">{formatRupiah(totals.totalCogs)}</td>
                  <td className={`pt-2 pr-3 text-right ${totals.grossProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {formatRupiah(totals.grossProfit)}
                  </td>
                  <td className={`pt-2 text-right ${marginColor(totals.marginPct)}`}>
                    {totals.marginPct !== null ? `${totals.marginPct}%` : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PerformanceRow({ row }: { row: MenuPerformanceRow }) {
  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="py-2 pr-3">
        <span className="font-medium">{row.name}</span>
        {row.variantLabel && (
          <span className="ml-1 text-xs text-muted-foreground">({row.variantLabel})</span>
        )}
        {!row.hasRecipe && (
          <span className="ml-1 text-xs text-muted-foreground italic">no resep</span>
        )}
      </td>
      <td className="py-2 pr-3 text-right">{row.qtySold}</td>
      <td className="py-2 pr-3 text-right">{formatRupiah(row.revenue)}</td>
      <td className="py-2 pr-3 text-right">
        {row.hasRecipe ? formatRupiah(row.cogsPerPortion) : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="py-2 pr-3 text-right">
        {row.hasRecipe ? formatRupiah(row.totalCogs) : <span className="text-muted-foreground">—</span>}
      </td>
      <td className={`py-2 pr-3 text-right ${row.hasRecipe ? (row.grossProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400") : "text-muted-foreground"}`}>
        {row.hasRecipe ? formatRupiah(row.grossProfit) : "—"}
      </td>
      <td className={`py-2 text-right font-medium ${marginColor(row.marginPct)}`}>
        {row.marginPct !== null ? `${row.marginPct}%` : "—"}
      </td>
    </tr>
  );
}
