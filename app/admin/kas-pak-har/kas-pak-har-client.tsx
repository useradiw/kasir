"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminSelect, ErrorBanner, AdminPageHeader } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { addKasPakHarEntry, deleteKasPakHarEntry } from "@/app/actions/admin/kas-pak-har";

type Entry = {
  id: string;
  date: string;
  type: string;
  amount: number;
  description: string | null;
  createdByName: string | null;
  expenseDescription: string | null;
  createdAt: string;
};

export default function KasPakHarClient({ data }: { data: { balance: number; entries: Entry[] } }) {
  const { isPending, run, error } = useAdminAction();
  const confirm = useConfirm();
  const [showAdd, setShowAdd] = useState(false);
  const [type, setType] = useState<"DEPOSIT" | "WITHDRAWAL">("DEPOSIT");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    run(
      () => addKasPakHarEntry({ type, amount: parseInt(amount), description: description || undefined }),
      {
        successMessage: type === "DEPOSIT" ? "Setoran berhasil" : "Penarikan berhasil",
        onSuccess: () => { setAmount(""); setDescription(""); },
      }
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Kas Pak Har">
        <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? "Batal" : "+ Tambah"}
        </Button>
      </AdminPageHeader>

      <ErrorBanner error={error} />

      {/* Balance */}
      <Card>
        <CardContent className="pt-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Saldo Saat Ini</p>
            <p className={`text-3xl font-bold ${data.balance < 0 ? "text-destructive" : "text-primary"}`}>
              {formatRupiah(data.balance)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Add form */}
      {showAdd && (
        <Card>
          <CardHeader><CardTitle>Tambah Entri</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
              <div className="grid gap-1">
                <Label>Tipe</Label>
                <AdminSelect value={type} onChange={(e) => setType(e.target.value as "DEPOSIT" | "WITHDRAWAL")}>
                  <option value="DEPOSIT">Setoran</option>
                  <option value="WITHDRAWAL">Penarikan</option>
                </AdminSelect>
              </div>
              <div className="grid gap-1">
                <Label>Jumlah (Rp)</Label>
                <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} required className="w-32" />
              </div>
              <div className="grid gap-1 flex-1 min-w-40">
                <Label>Keterangan</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opsional" />
              </div>
              <Button type="submit" size="sm" disabled={isPending || !amount}>Simpan</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader><CardTitle>Riwayat</CardTitle></CardHeader>
        <CardContent>
          {data.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Belum ada entri.</p>
          ) : (
            <div className="divide-y divide-foreground/5">
              {data.entries.map((e) => (
                <div key={e.id} className="flex items-start justify-between py-3 gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${e.type === "DEPOSIT" ? "text-primary" : e.type === "WITHDRAWAL" ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`}>
                        {e.type === "DEPOSIT" ? "+" : "-"}{formatRupiah(e.amount)}
                      </span>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
                        {e.type === "DEPOSIT" ? "Setoran" : e.type === "WITHDRAWAL" ? "Penarikan" : "Pengeluaran"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDateTime(e.date, "medium")}
                      {e.createdByName && <> &middot; {e.createdByName}</>}
                    </p>
                    {(e.description || e.expenseDescription) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {e.description || e.expenseDescription}
                      </p>
                    )}
                  </div>
                  {e.type !== "EXPENSE_DEDUCTION" && (
                    <Button
                      size="xs"
                      variant="destructive"
                      disabled={isPending}
                      onClick={async () => {
                        if (await confirm({ title: "Hapus entri ini?", destructive: true, confirmLabel: "Hapus" }))
                          run(() => deleteKasPakHarEntry(e.id), { successMessage: "Entri dihapus" });
                      }}
                    >
                      Hapus
                    </Button>
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
