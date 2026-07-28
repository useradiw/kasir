"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/ui";
import { PengeluaranForm } from "@/app/admin/keuangan/_components/pengeluaran-form";
import { recordPengeluaranAsStaff } from "@/app/actions/admin/keuangan";

type CashAccount = { name: string; label: string };
type Category = { code: string; name: string; bucket: "HPP" | "OPEX" };

export function ExpensesInputClient({
  cashAccounts,
  categories,
}: {
  cashAccounts: CashAccount[];
  categories: Category[];
}) {
  return (
    <div className="space-y-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Kembali
      </Link>

      <PageHeader title="Tambah Pengeluaran" />

      <PengeluaranForm
        cashAccounts={cashAccounts}
        categories={categories}
        action={recordPengeluaranAsStaff}
        successMessage="Pengeluaran berhasil dicatat"
      />
    </div>
  );
}
