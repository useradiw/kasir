"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BentoCard, CardLabel, Row, Tag } from "@/components/shell/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import {
  createCashAccount,
  renameCashAccount,
  setCashAccountActive,
  seedStructuralChart,
} from "@/app/actions/admin/keuangan";

type Account = { id: string; name: string; label: string; active: boolean };

export function AkunClient({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const { isPending, run, error } = useAdminAction();
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);

  function create(e: React.FormEvent) {
    e.preventDefault();
    run(
      async () => {
        await createCashAccount({ label });
        setLabel("");
        setAdding(false);
        router.refresh();
      },
      { successMessage: "Akun kas ditambahkan" },
    );
  }

  function rename(id: string, current: string) {
    const next = window.prompt("Nama baru akun kas:", current);
    if (next == null || next.trim() === current) return;
    run(async () => {
      await renameCashAccount({ id, label: next.trim() });
      router.refresh();
    }, { successMessage: "Nama akun kas diperbarui" });
  }

  function toggle(id: string, active: boolean) {
    run(async () => {
      await setCashAccountActive({ id, active });
      router.refresh();
    });
  }

  function seedChart() {
    run(async () => {
      await seedStructuralChart();
      router.refresh();
    }, { successMessage: "Struktur akun (chart of accounts) berhasil diisi" });
  }

  return (
    <>
      <BentoCard>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardLabel>Struktur Akun</CardLabel>
            <p className="mt-1 text-[11.5px] font-semibold leading-snug text-muted-foreground">
              Isi akun struktural (Pendapatan, HPP, Ekuitas) untuk posting otomatis. Aman diklik
              berulang — tidak menduplikasi atau menghapus data.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={seedChart} disabled={isPending} className="shrink-0">
            Isi akun default
          </Button>
        </div>
      </BentoCard>

      <BentoCard>
        {adding ? (
          <form onSubmit={create} className="flex flex-col gap-2.5">
            <CardLabel>Tambah akun kas</CardLabel>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Kas Laci Toko, Bank BCA…"
              required
              autoFocus
            />
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
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex w-full items-center justify-between text-left"
          >
            <div>
              <CardLabel>Akun kas</CardLabel>
              <p className="mt-1 text-[11.5px] font-semibold text-muted-foreground">
                Kas laci, bank — kamu yang mendefinisikan.
              </p>
            </div>
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-[16px] font-extrabold text-primary-foreground">
              +
            </span>
          </button>
        )}
      </BentoCard>

      {accounts.length === 0 ? (
        <BentoCard className="text-center text-[12.5px] font-semibold text-muted-foreground">
          Belum ada akun kas
        </BentoCard>
      ) : (
        <div className="flex flex-col gap-2.5">
          {accounts.map((a) => (
            <Row
              key={a.id}
              title={a.label}
              meta={
                <span className="font-mono">
                  {a.name}
                  {" · "}
                  {a.active ? "Aktif" : "Nonaktif"}
                </span>
              }
            >
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {!a.active ? <Tag tone="mut">Nonaktif</Tag> : null}
                <div className="flex gap-1.5">
                  <Button size="xs" variant="outline" disabled={isPending} onClick={() => rename(a.id, a.label)}>
                    Ubah nama
                  </Button>
                  <Button size="xs" variant="outline" disabled={isPending} onClick={() => toggle(a.id, !a.active)}>
                    {a.active ? "Nonaktifkan" : "Aktifkan"}
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
