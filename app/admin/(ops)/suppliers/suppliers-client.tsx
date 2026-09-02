"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BentoCard, Row } from "@/components/shell/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { addSupplier, updateSupplier, deleteSupplier } from "@/app/actions/admin/suppliers";

type Supplier = { id: string; name: string; phone: string | null; notes: string | null; createdAt: Date };

export default function SuppliersClient({ suppliers }: { suppliers: Supplier[] }) {
  const { isPending, run, error, setError } = useAdminAction();
  const confirm  = useConfirm();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId]   = useState<string | null>(null);

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setShowAdd((v) => !v); setError(null); }}>
          {showAdd ? "Batal" : "+ Tambah"}
        </Button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/35 bg-destructive-soft p-3.5 text-[12.5px] font-semibold text-destructive">
          {error}
        </div>
      ) : null}

      {showAdd && (
        <BentoCard>
          <form
            action={(fd) => run(
              () => addSupplier({
                name:  fd.get("name") as string,
                phone: fd.get("phone") as string || undefined,
                notes: fd.get("notes") as string || undefined,
              }),
              { successMessage: "Supplier ditambahkan", onSuccess: () => setShowAdd(false) },
            )}
            className="flex flex-col gap-3"
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1">
                <Label>Nama Supplier</Label>
                <Input name="name" required placeholder="cth: Bu Sari, Toko Sumber" className="w-44 border-border bg-card-2" />
              </div>
              <div className="grid gap-1">
                <Label>No. HP</Label>
                <Input name="phone" type="tel" placeholder="Opsional" className="w-36 border-border bg-card-2" />
              </div>
              <div className="grid min-w-40 flex-1 gap-1">
                <Label>Catatan</Label>
                <Input name="notes" placeholder="Opsional" className="border-border bg-card-2" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Batal</Button>
            </div>
          </form>
        </BentoCard>
      )}

      {suppliers.length === 0 ? (
        <p className="py-6 text-center text-[12.5px] font-semibold text-muted-foreground">
          Belum ada supplier.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {suppliers.map((s) =>
            editId === s.id ? (
              <BentoCard key={s.id}>
                <form
                  action={(fd) => run(
                    () => updateSupplier(s.id, {
                      name:  fd.get("name") as string,
                      phone: fd.get("phone") as string || undefined,
                      notes: fd.get("notes") as string || undefined,
                    }),
                    { successMessage: "Supplier diperbarui", onSuccess: () => setEditId(null) },
                  )}
                  className="flex flex-col gap-3"
                >
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="grid gap-1">
                      <Label>Nama</Label>
                      <Input name="name" defaultValue={s.name} required className="w-44 border-border bg-card-2" />
                    </div>
                    <div className="grid gap-1">
                      <Label>No. HP</Label>
                      <Input name="phone" type="tel" defaultValue={s.phone ?? ""} className="w-36 border-border bg-card-2" />
                    </div>
                    <div className="grid min-w-40 flex-1 gap-1">
                      <Label>Catatan</Label>
                      <Input name="notes" defaultValue={s.notes ?? ""} className="border-border bg-card-2" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(null)}>Batal</Button>
                  </div>
                </form>
              </BentoCard>
            ) : (
              <Row
                key={s.id}
                title={s.name}
                meta={
                  <>
                    {s.phone ? <>{s.phone}<br /></> : null}
                    {s.notes ?? null}
                  </>
                }
              >
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setEditId(s.id)}>Edit</Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isPending}
                    onClick={async () => {
                      if (await confirm({ title: `Hapus supplier "${s.name}"?`, destructive: true, confirmLabel: "Hapus" }))
                        run(() => deleteSupplier(s.id), { successMessage: "Supplier dihapus" });
                    }}
                  >
                    Hapus
                  </Button>
                </div>
              </Row>
            ),
          )}
        </div>
      )}
    </>
  );
}
