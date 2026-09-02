"use client";

import { useState } from "react";
import { Segmented } from "@/components/shell/sheet";
import type { BukuKasAccount, CekSaldoRow } from "@/app/actions/admin/queries";
import { BukuKasTab } from "./buku-kas-tab";
import { CekSaldoTab } from "./cek-saldo-tab";

type TabKey = "buku-kas" | "cek-saldo";
type CashAccount = { name: string; label: string };

/**
 * /buku/kas — reskin of app/admin/keuangan/buku-kas/buku-kas-client.tsx: same
 * two tabs, same data, on the shell's Segmented control instead of a ghost
 * button row.
 */
export function KasClient({
  accounts,
  cekSaldo,
  cashAccounts,
}: {
  accounts: BukuKasAccount[];
  cekSaldo: CekSaldoRow[];
  cashAccounts: CashAccount[];
}) {
  const [tab, setTab] = useState<TabKey>("buku-kas");

  return (
    <>
      <Segmented
        options={[
          { value: "buku-kas", label: "Buku Kas" },
          { value: "cek-saldo", label: "Cek Saldo" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "buku-kas" ? <BukuKasTab accounts={accounts} /> : <CekSaldoTab rows={cekSaldo} cashAccounts={cashAccounts} />}
    </>
  );
}
