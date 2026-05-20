"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminPageHeader, ErrorBanner } from "@/components/admin/ui";
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
    <div className="space-y-6">
      <AdminPageHeader title="Supplier">
        <Button size="sm" onClick={() => { setShowAdd((v) => !v); setError(null); }}>
          {showAdd ? "Batal" : "+ Tambah"}
        </Button>
      </AdminPageHeader>

      <ErrorBanner error={error} />

      {showAdd && (
        <Card>
          <CardContent className="pt-4">
            <form
              action={(fd) => run(
                () => addSupplier({
                  name:  fd.get("name") as string,
                  phone: fd.get("phone") as string || undefined,
                  notes: fd.get("notes") as string || undefined,
                }),
                { successMessage: "Supplier ditambahkan", onSuccess: () => setShowAdd(false) },
              )}
              className="space-y-3"
            >
              <div className="flex flex-wrap gap-3 items-end">
                <div className="grid gap-1">
                  <Label>Nama Supplier</Label>
                  <Input name="name" required placeholder="cth: Bu Sari, Toko Sumber" className="w-44" />
                </div>
                <div className="grid gap-1">
                  <Label>No. HP</Label>
                  <Input name="phone" type="tel" placeholder="Opsional" className="w-36" />
                </div>
                <div className="grid gap-1 flex-1 min-w-40">
                  <Label>Catatan</Label>
                  <Input name="notes" placeholder="Opsional" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Batal</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Daftar Supplier ({suppliers.length})</CardTitle></CardHeader>
        <CardContent>
          {suppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Belum ada supplier.</p>
          ) : (
            <div className="divide-y divide-foreground/5">
              {suppliers.map((s) => (
                <div key={s.id} className="py-3">
                  {editId === s.id ? (
                    <form
                      action={(fd) => run(
                        () => updateSupplier(s.id, {
                          name:  fd.get("name") as string,
                          phone: fd.get("phone") as string || undefined,
                          notes: fd.get("notes") as string || undefined,
                        }),
                        { successMessage: "Supplier diperbarui", onSuccess: () => setEditId(null) },
                      )}
                      className="space-y-3"
                    >
                      <div className="flex flex-wrap gap-3 items-end">
                        <div className="grid gap-1">
                          <Label>Nama</Label>
                          <Input name="name" defaultValue={s.name} required className="w-44" />
                        </div>
                        <div className="grid gap-1">
                          <Label>No. HP</Label>
                          <Input name="phone" type="tel" defaultValue={s.phone ?? ""} className="w-36" />
                        </div>
                        <div className="grid gap-1 flex-1 min-w-40">
                          <Label>Catatan</Label>
                          <Input name="notes" defaultValue={s.notes ?? ""} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(null)}>Batal</Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{s.name}</p>
                        {s.phone && <p className="text-xs text-muted-foreground">{s.phone}</p>}
                        {s.notes && <p className="text-xs text-muted-foreground">{s.notes}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="xs" variant="outline" onClick={() => setEditId(s.id)}>Edit</Button>
                        <Button size="xs" variant="destructive" disabled={isPending}
                          onClick={async () => {
                            if (await confirm({ title: `Hapus supplier "${s.name}"?`, destructive: true, confirmLabel: "Hapus" }))
                              run(() => deleteSupplier(s.id), { successMessage: "Supplier dihapus" });
                          }}>Hapus</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
