"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { exportCSV } from "@/lib/export-csv";
import { buildLaporanSections } from "@/lib/laporan-csv";
import type { LaporanKeuangan } from "@/app/actions/admin/queries/laporan-keuangan-queries";
import { LabaRugiTab } from "./_components/laba-rugi-tab";
import { NeracaTab } from "./_components/neraca-tab";
import { ArusKasTab } from "./_components/arus-kas-tab";
import { PerubahanModalTab } from "./_components/perubahan-modal-tab";
import { CalkTab } from "./_components/calk-tab";
import { ValidasiTab } from "./_components/validasi-tab";

type TabKey = "laba-rugi" | "neraca" | "arus-kas" | "perubahan-modal" | "calk" | "validasi";

const TABS: { value: TabKey; label: string }[] = [
  { value: "laba-rugi", label: "Laba Rugi" },
  { value: "neraca", label: "Neraca" },
  { value: "arus-kas", label: "Arus Kas" },
  { value: "perubahan-modal", label: "Perubahan Modal" },
  { value: "calk", label: "CALK" },
  { value: "validasi", label: "Validasi" },
];

/** True when nothing has ever posted to the ledger for this month — the
 *  screen should read as deliberate-and-empty, not broken, when this holds. */
function isBookEmpty(laporan: LaporanKeuangan): boolean {
  const { labaRugi, neraca, arusKas } = laporan;
  return (
    labaRugi.pendapatan.total === 0 &&
    labaRugi.hpp.total === 0 &&
    labaRugi.biaya_operasional.total === 0 &&
    neraca.aset.total === 0 &&
    arusKas.kas_awal === 0 &&
    arusKas.kas_akhir === 0
  );
}

export function LaporanClient({ laporan }: { laporan: LaporanKeuangan }) {
  const [tab, setTab] = useState<TabKey>("laba-rugi");
  const empty = isBookEmpty(laporan);

  function download() {
    exportCSV(`laporan-keuangan-${laporan.month}.csv`, buildLaporanSections(laporan));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Periode {laporan.period.dateFrom} s/d {laporan.period.dateTo}
        </p>
        <Button size="sm" variant="outline" onClick={download}>
          Unduh CSV
        </Button>
      </div>

      <nav className="flex flex-wrap gap-1 overflow-x-auto border-b pb-2">
        {TABS.map((t) => (
          <Button
            key={t.value}
            size="sm"
            variant="ghost"
            className={cn(
              "shrink-0 whitespace-nowrap",
              tab === t.value ? "bg-primary/10 text-primary" : "text-muted-foreground",
            )}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </Button>
        ))}
      </nav>

      {tab === "laba-rugi" && <LabaRugiTab laporan={laporan} isEmpty={empty} />}
      {tab === "neraca" && <NeracaTab laporan={laporan} isEmpty={empty} />}
      {tab === "arus-kas" && <ArusKasTab laporan={laporan} isEmpty={empty} />}
      {tab === "perubahan-modal" && <PerubahanModalTab laporan={laporan} isEmpty={empty} />}
      {tab === "calk" && <CalkTab calk={laporan.calk} month={laporan.month} />}
      {tab === "validasi" && <ValidasiTab laporan={laporan} />}
    </div>
  );
}
