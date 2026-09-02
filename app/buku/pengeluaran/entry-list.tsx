"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Row } from "@/components/shell/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { formatRupiah } from "@/lib/format";
import { sumJumlah } from "./totals";
import type { Jenis } from "./entry-form";
import { voidPengeluaran, voidCatat } from "@/app/actions/admin/keuangan";
import type { CatatSourceType } from "@/lib/accounting/catatRepository";

type CashAccount = { name: string; label: string };

type BelanjaRow = {
  id: string;
  date: string;
  item: string;
  jumlah: number;
  akun: string;
  kategoriCode: string;
  kategoriNama: string | null;
};

type CatatRow = {
  id: string;
  date: string;
  jumlah: number;
  meta: Record<string, unknown>;
  narration: string;
};

function labelFor(accounts: CashAccount[], name: unknown): string {
  return accounts.find((a) => a.name === name)?.label ?? String(name ?? "—");
}

/** The same keterangan composition the old catat-client.tsx built, per
 *  variant, so the list reads identically to the old screens. */
function keteranganFor(kind: Exclude<Jenis, "belanja">, cashAccounts: CashAccount[], row: CatatRow): string {
  const base =
    kind === "transfer"
      ? `${labelFor(cashAccounts, row.meta["dari"])} → ${labelFor(cashAccounts, row.meta["ke"])}`
      : kind === "modal"
        ? `${String(row.meta["nama"] ?? "")} · ${labelFor(cashAccounts, row.meta["akun"])}`
        : labelFor(cashAccounts, row.meta["akun"]);
  return row.meta["catatan"] ? `${base} — ${String(row.meta["catatan"])}` : base;
}

export function EntryList({
  jenis,
  cashAccounts,
  rows,
  month,
}: {
  jenis: Jenis;
  cashAccounts: CashAccount[];
  rows: BelanjaRow[] | CatatRow[];
  month: string;
}) {
  const router = useRouter();
  const { isPending, run } = useAdminAction();
  const confirm = useConfirm();

  const total = sumJumlah(rows.map((r) => ({ jumlah: r.jumlah })));

  async function removeBelanja(id: string) {
    if (!(await confirm({ title: "Hapus (void) pengeluaran ini?", destructive: true, confirmLabel: "Hapus" }))) return;
    run(async () => {
      await voidPengeluaran(id);
      router.refresh();
    }, { successMessage: "Pengeluaran dihapus" });
  }

  async function removeCatat(id: string) {
    if (!(await confirm({ title: "Hapus (void) entri ini?", destructive: true, confirmLabel: "Hapus" }))) return;
    run(async () => {
      await voidCatat(id, jenis as CatatSourceType);
      router.refresh();
    }, { successMessage: "Entri dihapus" });
  }

  const countLabel = jenis === "belanja" ? "pengeluaran" : "entri";
  const emptyLabel = jenis === "belanja" ? "Belum ada pengeluaran bulan ini" : "Belum ada entri bulan ini";

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[11.5px] font-semibold text-muted-foreground">
        {rows.length} {countLabel} &middot; {month}
      </p>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-[12.5px] font-semibold text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <>
          {jenis === "belanja"
            ? (rows as BelanjaRow[]).map((r) => (
                <Row
                  key={r.id}
                  title={r.item}
                  meta={`${r.kategoriNama ?? r.kategoriCode} · ${r.date}`}
                >
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-[13px] font-bold tabular-nums">{formatRupiah(r.jumlah)}</span>
                    <Button size="xs" variant="destructive" disabled={isPending} onClick={() => removeBelanja(r.id)}>
                      Void
                    </Button>
                  </div>
                </Row>
              ))
            : (rows as CatatRow[]).map((r) => (
                <Row
                  key={r.id}
                  title={keteranganFor(jenis as Exclude<Jenis, "belanja">, cashAccounts, r)}
                  meta={r.date}
                >
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-[13px] font-bold tabular-nums">{formatRupiah(r.jumlah)}</span>
                    <Button size="xs" variant="destructive" disabled={isPending} onClick={() => removeCatat(r.id)}>
                      Void
                    </Button>
                  </div>
                </Row>
              ))}

          <div className="flex items-center justify-between rounded-2xl border border-border bg-card-2 p-3.5">
            <span className="text-[12.5px] font-bold">Total</span>
            <span className="font-display text-[15px] font-bold tabular-nums">{formatRupiah(total)}</span>
          </div>
        </>
      )}
    </div>
  );
}
