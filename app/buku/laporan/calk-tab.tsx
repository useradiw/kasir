"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/admin/ui";
import { BentoCard, CardLabel } from "@/components/shell/ui";
import { formatRupiah } from "@/lib/format";
import { useAdminAction } from "@/hooks/use-admin-action";
import { saveCalkNote } from "@/app/actions/admin/keuangan";
import type { CalkResult, CalkSection } from "@/lib/calk";

/**
 * CALK (Catatan Atas Laporan Keuangan) tab — reskin of app/admin/keuangan/
 * laporan/_components/calk-tab.tsx (mockup 5). Each section has generated
 * (read-only) rows plus one owner-editable free-text note, saved
 * independently via saveCalkNote({ month, sectionKey, note }) — unchanged
 * from the old tab — so saving one section's textarea never touches any
 * other section's note.
 */
export function CalkTab({ calk, month }: { calk: CalkResult; month: string }) {
  return (
    <div className="flex flex-col gap-3">
      {calk.sections.map((section) => (
        <CalkSectionCard key={section.key} section={section} month={month} />
      ))}
    </div>
  );
}

function CalkSectionCard({ section, month }: { section: CalkSection; month: string }) {
  const { isPending, run, error } = useAdminAction();
  const [note, setNote] = useState(section.note);
  const [saved, setSaved] = useState(true);

  function save() {
    run(
      async () => {
        await saveCalkNote({ month, sectionKey: section.key, note });
        setSaved(true);
      },
      { successMessage: `Catatan "${section.title}" disimpan` },
    );
  }

  return (
    <BentoCard className="flex flex-col gap-2.5">
      <CardLabel>{section.title}</CardLabel>

      {section.generated.length === 0 ? (
        <p className="text-[12.5px] font-semibold text-muted-foreground">Tidak ada data untuk bagian ini.</p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {section.generated.map((g, i) => (
            <div key={`${g.label}-${i}`} className="flex items-center justify-between py-1 text-[12.5px] font-semibold">
              <span className="text-muted-foreground">{g.label}</span>
              <span className="tabular-nums">
                {typeof g.value === "number" ? formatRupiah(g.value) : g.value}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[11.5px] font-semibold text-muted-foreground">Catatan (opsional)</label>
        <textarea
          className="min-h-20 w-full rounded-xl border border-input bg-input/30 p-2.5 text-[12.5px]"
          value={note}
          placeholder="Tambahkan penjelasan untuk bagian ini..."
          disabled={isPending}
          onChange={(e) => {
            setNote(e.target.value);
            setSaved(e.target.value === section.note);
          }}
        />
        <ErrorBanner error={error} />
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={isPending || saved}>
            {isPending ? "Menyimpan..." : "Simpan Catatan"}
          </Button>
        </div>
      </div>
    </BentoCard>
  );
}
