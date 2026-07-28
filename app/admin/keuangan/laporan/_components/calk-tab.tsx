"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/admin/ui";
import { formatRupiah } from "@/lib/format";
import { useAdminAction } from "@/hooks/use-admin-action";
import { saveCalkNote } from "@/app/actions/admin/keuangan";
import type { CalkResult, CalkSection } from "@/lib/calk";

/**
 * CALK (Catatan Atas Laporan Keuangan) tab. Each section has generated
 * (read-only) rows plus one owner-editable free-text note, saved
 * independently via saveCalkNote({ month, sectionKey, note }) — saving one
 * section's textarea must not touch any other section's note.
 */
export function CalkTab({ calk, month }: { calk: CalkResult; month: string }) {
  return (
    <div className="space-y-4">
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
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{section.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {section.generated.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada data untuk bagian ini.</p>
        ) : (
          <div className="space-y-0">
            {section.generated.map((g, i) => (
              <div key={`${g.label}-${i}`} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-muted-foreground">{g.label}</span>
                <span className="tabular-nums">
                  {typeof g.value === "number" ? formatRupiah(g.value) : g.value}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Catatan (opsional)</label>
          <textarea
            className="min-h-20 w-full rounded-xl border border-input bg-input/30 p-2.5 text-sm"
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
      </CardContent>
    </Card>
  );
}
