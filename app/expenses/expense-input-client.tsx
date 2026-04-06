"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBanner } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { addExpenseForStaff } from "@/app/actions/expenses";

export default function ExpenseInputClient() {
  const { isPending, run, error } = useAdminAction();
  const [success, setSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(fd: FormData) {
    setSuccess(false);
    await run(() => addExpenseForStaff(fd));
    formRef.current?.reset();
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  }

  return (
    <div className="space-y-4">
      <Link
        href="/cashregister"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Kembali
      </Link>

      <h1 className="text-2xl font-bold">Tambah Pengeluaran</h1>

      <ErrorBanner error={error} />

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm text-primary">
          <Check className="size-4" />
          Pengeluaran berhasil ditambahkan.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Detail Pengeluaran</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            ref={formRef}
            action={handleSubmit}
            className="grid gap-4"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="amount">Jumlah (Rp)</Label>
              <Input id="amount" name="amount" type="number" min={1} required placeholder="Jumlah" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="note">Keterangan</Label>
              <Input id="note" name="note" placeholder="Keterangan (opsional)" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="recordedAt">Tanggal</Label>
              <Input id="recordedAt" name="recordedAt" type="datetime-local" />
            </div>
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Menyimpan..." : "Tambah Pengeluaran"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
