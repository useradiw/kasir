"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { AdminPageHeader, ErrorBanner, UnitClassBadge } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { updateUnitSettings } from "@/app/actions/admin/unit-settings";

type UnitClass = "WEIGHT" | "VOLUME" | "COUNT";

type View = {
  current:        Record<UnitClass, string>;
  defaults:       Record<UnitClass, string>;
  countByClass:   Record<UnitClass, number>;
  inUseByClass:   Record<UnitClass, boolean>;
};

const ORDER: UnitClass[] = ["WEIGHT", "VOLUME", "COUNT"];

const HELP: Record<UnitClass, string> = {
  WEIGHT: "Berat — default mg. Cocok untuk bahan padat (tepung, gula, daging, rempah).",
  VOLUME: "Volume — default ml. Cocok untuk cairan (susu, minyak, saus, air).",
  COUNT:  "Jumlah — default pcs. Cocok untuk satuan diskrit (gelas, cup, plastik, telur).",
};

export default function SatuanClient({ initial }: { initial: View }) {
  const { isPending, run, error, setError } = useAdminAction();
  const [values, setValues] = useState(initial.current);

  function setField(cls: UnitClass, v: string) {
    setError(null);
    setValues((s) => ({ ...s, [cls]: v }));
  }

  function reset(cls: UnitClass) {
    setField(cls, initial.defaults[cls]);
  }

  function save() {
    run(
      async () => {
        await updateUnitSettings({
          unit_base_weight: values.WEIGHT,
          unit_base_volume: values.VOLUME,
          unit_base_count:  values.COUNT,
        });
      },
      { successMessage: "Satuan dasar tersimpan." },
    );
  }

  const dirty = ORDER.some((cls) => values[cls].trim() !== initial.current[cls]);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Satuan & Konversi" />
      <p className="text-sm text-muted-foreground">
        Tetapkan satuan dasar terkecil per kelas. Semua bahan dalam kelas yang sama
        akan menggunakan satuan ini sebagai dasar stok & HPP. Mengubah satuan dasar
        sebuah kelas <strong>diblokir</strong> bila masih ada bahan kelas itu dengan
        stok atau riwayat — agar nilai HPP historis tidak rusak.
      </p>

      <ErrorBanner error={error} />

      <div className="space-y-3">
        {ORDER.map((cls) => {
          const locked = initial.inUseByClass[cls] && values[cls] !== initial.current[cls];
          const count = initial.countByClass[cls];
          return (
            <Card key={cls}>
              <CardContent className="space-y-3 py-4">
                <div className="flex items-center gap-2">
                  <UnitClassBadge unitClass={cls} />
                  <span className="text-sm text-muted-foreground">
                    {count} bahan
                    {initial.inUseByClass[cls] && (
                      <span className="ml-2 text-warning-foreground bg-warning/10 rounded px-1.5 py-0.5 text-xs">
                        ada stok/riwayat
                      </span>
                    )}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{HELP[cls]}</p>
                <div className="flex items-end gap-2">
                  <div className="grid gap-1 flex-1">
                    <Label className="text-xs">Satuan dasar</Label>
                    <Input
                      value={values[cls]}
                      onChange={(e) => setField(cls, e.target.value)}
                      placeholder={initial.defaults[cls]}
                    />
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => reset(cls)}>
                    Reset ({initial.defaults[cls]})
                  </Button>
                </div>
                {locked && (
                  <p className="text-xs text-destructive">
                    Tidak bisa diubah sekarang — ada bahan kelas {cls} dengan stok/riwayat.
                    Opname nol dulu, atau biarkan satuan saat ini.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button onClick={save} disabled={isPending || !dirty}>
          Simpan
        </Button>
        <Button variant="ghost" disabled={isPending || !dirty} onClick={() => setValues(initial.current)}>
          Batal
        </Button>
      </div>
    </div>
  );
}
