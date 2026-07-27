"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminSelect, ErrorBanner } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { Field } from "../_components/form-ui";
import { createCategory, updateCategory, deleteCategory, seedDefaultCategories } from "@/app/actions/admin/keuangan";

type Category = { id: string; code: string; name: string; bucket: "HPP" | "OPEX"; active: boolean };

export function KategoriClient({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const { isPending, run, error } = useAdminAction();
  const confirm = useConfirm();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [bucket, setBucket] = useState<"HPP" | "OPEX">("OPEX");

  function create(e: React.FormEvent) {
    e.preventDefault();
    run(async () => {
      await createCategory({ code, name, bucket });
      setCode("");
      setName("");
      router.refresh();
    }, { successMessage: "Kategori ditambahkan" });
  }

  function toggle(id: string, active: boolean) {
    run(async () => {
      await updateCategory({ id, active });
      router.refresh();
    });
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "Hapus kategori ini?", destructive: true, confirmLabel: "Hapus" }))) return;
    run(async () => {
      await deleteCategory(id);
      router.refresh();
    }, { successMessage: "Kategori dihapus" });
  }

  function seedDefaults() {
    run(async () => {
      await seedDefaultCategories();
      router.refresh();
    }, { successMessage: "Kategori default ditambahkan" });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <form onSubmit={create} className="h-fit space-y-3 rounded-lg border bg-card p-4">
        <p className="text-sm font-medium">Tambah Kategori</p>
        <Field label="Kode" hint="Huruf besar, mis. LISTRIK">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="LISTRIK" required />
        </Field>
        <Field label="Nama">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Listrik" required />
        </Field>
        <Field label="Kelompok">
          <AdminSelect className="w-full" value={bucket} onChange={(e) => setBucket(e.target.value as "HPP" | "OPEX")}>
            <option value="OPEX">Biaya Operasional (OpEx)</option>
            <option value="HPP">Harga Pokok (HPP)</option>
          </AdminSelect>
        </Field>
        <ErrorBanner error={error} />
        <Button type="submit" disabled={isPending}>{isPending ? "Menyimpan..." : "Simpan"}</Button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-card">
        {categories.length === 0 ? (
          <div className="space-y-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">Belum ada kategori</p>
            <Button variant="secondary" onClick={seedDefaults} disabled={isPending}>
              Isi kategori default
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-3">Kode</th>
                  <th className="p-3">Nama</th>
                  <th className="p-3">Kelompok</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                {categories.map((c) => (
                  <tr key={c.id} className="text-sm">
                    <td className="p-3 font-mono">{c.code}</td>
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3">{c.bucket === "HPP" ? "HPP" : "OpEx"}</td>
                    <td className="p-3">
                      {c.active ? (
                        <span className="text-primary">Aktif</span>
                      ) : (
                        <span className="text-muted-foreground">Nonaktif</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="xs" variant="outline" disabled={isPending} onClick={() => toggle(c.id, !c.active)}>
                          {c.active ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                        <Button size="xs" variant="destructive" disabled={isPending} onClick={() => remove(c.id)}>
                          Hapus
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
