"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorBanner } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { Field } from "../_components/form-ui";
import { createCashAccount, renameCashAccount, setCashAccountActive, seedStructuralChart } from "@/app/actions/admin/keuangan";

type Account = { id: string; name: string; label: string; active: boolean };

export function AkunClient({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const { isPending, run, error } = useAdminAction();
  const [label, setLabel] = useState("");

  function create(e: React.FormEvent) {
    e.preventDefault();
    run(async () => {
      await createCashAccount({ label });
      setLabel("");
      router.refresh();
    }, { successMessage: "Akun kas ditambahkan" });
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
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Struktur Akun (Chart of Accounts)</p>
            <p className="text-xs text-muted-foreground">
              Isi akun struktural (Pendapatan, HPP, Ekuitas) yang dipakai proses posting otomatis.
              Aman diklik berulang kali — tidak akan menduplikasi atau menghapus data.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={seedChart} disabled={isPending}>
            Isi akun default
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <form onSubmit={create} className="h-fit space-y-3 rounded-lg border bg-card p-4">
          <p className="text-sm font-medium">Tambah Akun Kas</p>
          <Field label="Nama akun kas" hint="Mis. Kas Laci Toko, Bank BCA">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Kas Laci Toko" required />
          </Field>
          <ErrorBanner error={error} />
          <Button type="submit" disabled={isPending}>{isPending ? "Menyimpan..." : "Simpan"}</Button>
        </form>

        <div className="overflow-hidden rounded-lg border bg-card">
          {accounts.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Belum ada akun kas</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="p-3">Nama</th>
                    <th className="p-3">Akun (ledger)</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/5">
                  {accounts.map((a) => (
                    <tr key={a.id} className="text-sm">
                      <td className="p-3 font-medium">{a.label}</td>
                      <td className="p-3 font-mono text-muted-foreground">{a.name}</td>
                      <td className="p-3">
                        {a.active ? (
                          <span className="text-primary">Aktif</span>
                        ) : (
                          <span className="text-muted-foreground">Nonaktif</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="xs" variant="outline" disabled={isPending} onClick={() => rename(a.id, a.label)}>
                            Ubah nama
                          </Button>
                          <Button size="xs" variant="outline" disabled={isPending} onClick={() => toggle(a.id, !a.active)}>
                            {a.active ? "Nonaktifkan" : "Aktifkan"}
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
    </div>
  );
}
