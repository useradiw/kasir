"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AdminPageHeader, AdminSelect } from "@/components/admin/ui";
import { Badge } from "@/components/shared/badge";
import { formatRpPerUnit } from "@/lib/format";
import type {
  AssembledIngredientsIndex,
  ActiveIngredientLite,
} from "@/app/actions/admin/queries/ingredient-queries";

type Props = {
  data:      AssembledIngredientsIndex;
  allActive: ActiveIngredientLite[];
};

export default function ResepOlahanClient({ data, allActive }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState("");

  // Ingredients that DON'T already have a recipe — these are candidates for new BOMs
  const parentIds = useMemo(() => new Set(data.parents.map((p) => p.id)), [data.parents]);
  const candidates = useMemo(
    () => allActive.filter((i) => !parentIds.has(i.id)),
    [allActive, parentIds],
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Resep Bahan Olahan" />
      <p className="text-sm text-muted-foreground">
        Bahan olahan = bahan yang dirakit dari bahan-bahan lain (misal: saus,
        kaldu, bumbu jadi). Setiap produksi (assembly) mengkonsumsi stok komponen
        dan menambah stok bahan induk dengan HPP rata-rata terbaru.
      </p>

      <div>
        <Button size="sm" onClick={() => setPickerOpen((s) => !s)}>
          + Buat Resep Olahan Baru
        </Button>
      </div>

      {pickerOpen && (
        <Card>
          <CardHeader><CardTitle>Pilih Bahan Induk</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Pilih bahan yang akan menjadi <strong>hasil</strong> dari resep ini.
              Klik &quot;Buka Editor&quot; — akan masuk ke detail bahan tersebut, tab Resep.
            </p>
            <div className="grid gap-1.5">
              <Label>Bahan Induk</Label>
              <AdminSelect value={picked} onChange={(e) => setPicked(e.target.value)}>
                <option value="">— Pilih bahan —</option>
                {candidates.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} · {i.unit} ({i.unitClass})
                  </option>
                ))}
              </AdminSelect>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!picked}
                render={<Link href={picked ? `/admin/ingredients/${picked}?tab=resep` : "#"} />}
              >
                Buka Editor
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setPickerOpen(false); setPicked(""); }}>
                Batal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Bahan Olahan ({data.parents.length})</h2>
        {data.parents.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
            Belum ada bahan olahan. Klik &quot;+ Buat Resep Olahan Baru&quot;.
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {data.parents.map((p) => (
              <Card key={p.id}>
                <CardContent className="py-3">
                  <Link
                    href={`/admin/ingredients/${p.id}?tab=resep`}
                    className="flex items-center gap-3 hover:bg-muted/30 -mx-3 -my-3 px-3 py-3 rounded"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{p.name}</span>
                        <Badge className="text-[10px] bg-muted text-muted-foreground">{p.unit}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                        Hasil/batch: {p.yieldQty} {p.unit} ·{" "}
                        {p.componentCount} komponen ·{" "}
                        Stok: {p.currentStock} {p.unit}
                        {p.unitCost > 0 && ` · HPP ${formatRpPerUnit(p.unitCost)}/${p.unit}`}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">→</span>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Komponen Aktif ({data.components.length})</h2>
        <p className="text-xs text-muted-foreground">
          Bahan-bahan yang dipakai sebagai komponen di setidaknya satu resep olahan.
        </p>
        {data.components.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
            Belum ada komponen.
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {data.components.map((c) => (
              <Card key={c.id}>
                <CardContent className="py-3">
                  <Link
                    href={`/admin/ingredients/${c.id}`}
                    className="flex items-center gap-3 hover:bg-muted/30 -mx-3 -my-3 px-3 py-3 rounded"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{c.name}</span>
                        <Badge className="text-[10px] bg-muted text-muted-foreground">{c.unit}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Dipakai di: {c.usedIn.map((u) => u.name).join(", ")}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">→</span>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
