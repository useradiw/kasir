"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/shell/sheet";
import { exportCSV } from "@/lib/export-csv";
import { buildLaporanSections } from "@/lib/laporan-csv";
import type { LaporanKeuangan } from "@/app/actions/admin/queries/laporan-keuangan-queries";
import { LabaRugiTab } from "./laba-rugi-tab";
import { NeracaTab } from "./neraca-tab";
import { ArusKasTab } from "./arus-kas-tab";
import { PerubahanModalTab } from "./perubahan-modal-tab";
import { CalkTab } from "./calk-tab";
import { ValidasiTab } from "./validasi-tab";

type TabKey = "laba-rugi" | "neraca" | "arus-kas" | "modal" | "calk" | "validasi";

// Labels verbatim from the mockup chips (docs/redesign/screens-laporan.html
// mockups 1-5): "Modal", not the old client's "Perubahan Modal" — the
// mockup's own shorthand for the tab chip, spelled out in full inside the
// tab itself (perubahan-modal-tab.tsx's CardLabel still says "Perubahan
// Modal").
const TABS: { value: TabKey; label: string }[] = [
  { value: "laba-rugi", label: "Laba Rugi" },
  { value: "neraca", label: "Neraca" },
  { value: "arus-kas", label: "Arus Kas" },
  { value: "modal", label: "Modal" },
  { value: "calk", label: "CALK" },
  { value: "validasi", label: "Validasi" },
];

/** True when nothing has ever posted to the ledger for this month — carried
 *  across unchanged from the old laporan-client.tsx. */
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

/**
 * /buku/laporan client — reskin of app/admin/keuangan/laporan/
 * laporan-client.tsx on the Segmented tab control (the same primitive
 * app/buku/kas/kas-client.tsx already uses for its two tabs). The CSV export
 * is the old screen's exact wiring, reused unchanged: exportCSV (lib/
 * export-csv.ts, covered by test/export-csv.test.ts) fed by
 * buildLaporanSections (lib/laporan-csv.ts) — neither function changed.
 */
export function LaporanClient({ laporan }: { laporan: LaporanKeuangan }) {
  const [tab, setTab] = useState<TabKey>("laba-rugi");
  const empty = isBookEmpty(laporan);

  function download() {
    exportCSV(`laporan-keuangan-${laporan.month}.csv`, buildLaporanSections(laporan));
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-muted-foreground">
          Periode {laporan.period.dateFrom} s/d {laporan.period.dateTo}
        </p>
        <Button size="sm" variant="outline" onClick={download}>
          ⬇ Unduh CSV
        </Button>
      </div>

      <Segmented options={TABS} value={tab} onChange={setTab} />

      {tab === "laba-rugi" && <LabaRugiTab laporan={laporan} isEmpty={empty} />}
      {tab === "neraca" && <NeracaTab laporan={laporan} isEmpty={empty} />}
      {tab === "arus-kas" && <ArusKasTab laporan={laporan} isEmpty={empty} />}
      {tab === "modal" && <PerubahanModalTab laporan={laporan} isEmpty={empty} />}
      {tab === "calk" && <CalkTab calk={laporan.calk} month={laporan.month} />}
      {tab === "validasi" && <ValidasiTab laporan={laporan} />}
    </>
  );
}
