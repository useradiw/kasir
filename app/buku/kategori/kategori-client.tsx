"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminSelect } from "@/components/admin/ui";
import { BentoCard, CardLabel, Row, Tag } from "@/components/shell/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { useConfirm } from "@/components/shared/confirm-dialog";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  seedDefaultCategories,
} from "@/app/actions/admin/keuangan";

type Category = { id: string; code: string; name: string; bucket: "HPP" | "OPEX"; active: boolean };

export function KategoriClient({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const { isPending, run, error } = useAdminAction();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [bucket, setBucket] = useState<"HPP" | "OPEX">("OPEX");

  function create(e: React.FormEvent) {
    e.preventDefault();
    run(
      async () => {
        await createCategory({ code, name, bucket });
        setCode("");
        setName("");
        setAdding(false);
        router.refresh();
      },
      { successMessage: "Kategori ditambahkan" },
    );
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
    <>
      {/* Seed button is always available, not gated on an empty list — the
          categories screen is never "done", categories keep getting added. */}
      <div className="flex gap-2">
        <Button variant="outline" disabled={isPending} onClick={seedDefaults} className="flex-1">
          Isi kategori default
        </Button>
        <Button disabled={isPending} onClick={() => setAdding((v) => !v)} className="flex-1">
          + Baru
        </Button>
      </div>

      {adding ? (
        <BentoCard>
          <form onSubmit={create} className="flex flex-col gap-2.5">
            <CardLabel>Tambah kategori</CardLabel>
            <div>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Kode — mis. LISTRIK"
                required
                autoFocus
              />
            </div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama — mis. Listrik"
              required
            />
            <AdminSelect
              className="w-full"
              value={bucket}
              onChange={(e) => setBucket(e.target.value as "HPP" | "OPEX")}
            >
              <option value="OPEX">Biaya Operasional (OpEx)</option>
              <option value="HPP">Harga Pokok (HPP)</option>
            </AdminSelect>
            {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={isPending} className="flex-1">
                {isPending ? "Menyimpan…" : "Simpan"}
              </Button>
              <Button type="button" variant="ghost" disabled={isPending} onClick={() => setAdding(false)}>
                Batal
              </Button>
            </div>
          </form>
        </BentoCard>
      ) : null}

      {categories.length === 0 ? (
        <BentoCard className="text-center text-[12.5px] font-semibold text-muted-foreground">
          Belum ada kategori
        </BentoCard>
      ) : (
        <div className="flex flex-col gap-2.5">
          {categories.map((c) => (
            <Row key={c.id} title={c.name} meta={<span className="font-mono">{c.code}</span>}>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <div className="flex gap-1">
                  <Tag tone={c.bucket === "HPP" ? "acc" : "mut"}>{c.bucket === "HPP" ? "HPP" : "OpEx"}</Tag>
                  {!c.active ? <Tag tone="mut">Nonaktif</Tag> : null}
                </div>
                <div className="flex gap-1.5">
                  <Button size="xs" variant="outline" disabled={isPending} onClick={() => toggle(c.id, !c.active)}>
                    {c.active ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                  <Button size="xs" variant="destructive" disabled={isPending} onClick={() => remove(c.id)}>
                    Hapus
                  </Button>
                </div>
              </div>
            </Row>
          ))}
        </div>
      )}
    </>
  );
}
