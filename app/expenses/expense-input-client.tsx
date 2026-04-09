"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBanner } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { addExpenseForStaff } from "@/app/actions/expenses";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { useState } from "react";

export default function ExpenseInputClient() {
  const { isPending, run, error } = useAdminAction();
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="space-y-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Kembali
      </Link>

      <h1 className="text-2xl font-bold">Tambah Pengeluaran</h1>

      <ErrorBanner error={error} />

      <Card>
        <CardHeader>
          <CardTitle>Detail Pengeluaran</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpenseForm
            key={formKey}
            mode="add"
            isPending={isPending}
            onSubmit={(data) =>
              run(() => addExpenseForStaff(data), {
                successMessage: "Pengeluaran berhasil ditambahkan",
                onSuccess: () => setFormKey((k) => k + 1),
              })
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
