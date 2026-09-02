"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMonth } from "../_components/month-picker";
import type { BukuKasAccount, CekSaldoRow } from "@/app/actions/admin/queries/buku-kas-queries";
import { BukuKasTab } from "./_components/buku-kas-tab";
import { CekSaldoTab } from "./_components/cek-saldo-tab";

type TabKey = "buku-kas" | "cek-saldo";
type CashAccount = { name: string; label: string };

const TABS: { value: TabKey; label: string }[] = [
  { value: "buku-kas", label: "Buku Kas" },
  { value: "cek-saldo", label: "Cek Saldo" },
];

export function BukuKasClient({
  month,
  accounts,
  cekSaldo,
  cashAccounts,
}: {
  month: string;
  accounts: BukuKasAccount[];
  cekSaldo: CekSaldoRow[];
  cashAccounts: CashAccount[];
}) {
  const [tab, setTab] = useState<TabKey>("buku-kas");

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Bulan {formatMonth(month)}</p>

      <nav className="flex flex-wrap gap-1 overflow-x-auto border-b pb-2">
        {TABS.map((t) => (
          <Button
            key={t.value}
            size="sm"
            variant="ghost"
            className={cn(
              "shrink-0 whitespace-nowrap",
              tab === t.value ? "bg-primary/10 text-primary" : "text-muted-foreground",
            )}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </Button>
        ))}
      </nav>

      {tab === "buku-kas" && <BukuKasTab accounts={accounts} />}
      {tab === "cek-saldo" && <CekSaldoTab rows={cekSaldo} cashAccounts={cashAccounts} />}
    </div>
  );
}
