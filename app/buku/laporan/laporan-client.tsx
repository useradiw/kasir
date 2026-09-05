"use client";

import { useState } from "react";
import { Segmented } from "@/components/shell/sheet";
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

/** True when nothing has ever posted to the ledger for this period — carried
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
 * /buku/laporan client — the six statement tabs.
 *
 * The period picker and the download menu deliberately do NOT live here: they
 * sit in the page header (see laporan-actions.tsx), which is what the mockup
 * specifies and what keeps the body to a single row of chrome.
 */
export function LaporanClient({
  laporan,
  setupComplete,
}: {
  laporan: LaporanKeuangan;
  setupComplete: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("laba-rugi");
  const empty = isBookEmpty(laporan);

  return (
    <>
      <Segmented options={TABS} value={tab} onChange={setTab} />

      {tab === "laba-rugi" && <LabaRugiTab laporan={laporan} isEmpty={empty} setupComplete={setupComplete} />}
      {tab === "neraca" && <NeracaTab laporan={laporan} isEmpty={empty} setupComplete={setupComplete} />}
      {tab === "arus-kas" && <ArusKasTab laporan={laporan} isEmpty={empty} setupComplete={setupComplete} />}
      {tab === "modal" && <PerubahanModalTab laporan={laporan} isEmpty={empty} setupComplete={setupComplete} />}
      {tab === "calk" && <CalkTab calk={laporan.calk} month={laporan.month} />}
      {tab === "validasi" && <ValidasiTab laporan={laporan} />}
    </>
  );
}
