import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/admin-auth";
import { cn } from "@/lib/utils";
import { listPengeluaran, listCategories, listCashAccounts, listCatat } from "@/app/actions/admin/queries";
import { getSelectedMonth, monthRange } from "@/lib/keuangan-month";
import { recordPengeluaran } from "@/app/actions/admin/keuangan";
import type { CatatSourceType } from "@/lib/accounting/catatRepository";
import { EntryForm, JENIS_VALUES, PILL_LABEL, VARIANT_TITLE, type Jenis } from "./entry-form";
import { EntryList } from "./entry-list";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** Local copy of the "YYYY-MM" -> "Agustus 2026" formatter (same duplication
 *  bulan-client.tsx already carries on purpose — app/admin/keuangan is
 *  slated for deletion once every /buku equivalent exists). */
function formatMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return `${MONTH_NAMES[(mo ?? 1) - 1]} ${y}`;
}

function parseJenis(raw: string | string[] | undefined): Jenis {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (JENIS_VALUES as string[]).includes(value ?? "") ? (value as Jenis) : "belanja";
}

/**
 * /buku/pengeluaran — the shared entry-form template for belanja, transfer,
 * modal, prive and saldo-awal (SPEC #13), replaces app/admin/keuangan/
 * {pengeluaran,transfer,modal,prive,saldo-awal} (five old pages merged into
 * one route with a `?jenis=` variant, docs/redesign/plan-open-items.md
 * section 1, build order 5). Reuses every server action/query unchanged.
 */
export default async function BukuPengeluaranPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const staff = await requireOwner();
  const { jenis: jenisParam } = await searchParams;
  const jenis = parseJenis(jenisParam);
  const { dateFrom, dateTo, month } = monthRange(await getSelectedMonth());

  const [cashAccounts, pengeluaranRows, categories, catatRows] = await Promise.all([
    listCashAccounts(),
    jenis === "belanja" ? listPengeluaran({ dateFrom, dateTo }) : Promise.resolve([]),
    jenis === "belanja" ? listCategories() : Promise.resolve([]),
    jenis !== "belanja" ? listCatat(jenis as CatatSourceType, { dateFrom, dateTo }) : Promise.resolve([]),
  ]);

  const cashAccountsMapped = cashAccounts.map((a) => ({ name: a.name, label: a.label }));
  const categoriesMapped = categories.filter((c) => c.active).map((c) => ({ code: c.code, name: c.name, bucket: c.bucket }));
  const belanjaRows = pengeluaranRows.map((r) => ({
    id: r.id,
    date: r.date,
    item: r.item,
    jumlah: r.jumlah,
    akun: r.akun,
    kategoriCode: r.kategoriCode,
    kategoriNama: r.kategoriNama,
  }));
  const catatRowsMapped = catatRows.map((r) => ({
    id: r.id,
    date: r.date,
    jumlah: r.jumlah,
    meta: r.meta as Record<string, unknown>,
    narration: r.narration,
  }));

  // saldo-awal's info alert (mockup 3): derived from the rows already
  // fetched for this month — no extra query.
  const saldoAwalEmpty = jenis === "saldo-awal" && catatRowsMapped.length === 0;

  return (
    <AppShell role={staff.role}>
      <div className="px-4 pb-1 pt-5">
        <Link href="/buku" className="text-[12.5px] font-bold text-muted-foreground">
          ← Buku
        </Link>
        <h1 className="font-display mt-2 text-[17px] font-bold">{VARIANT_TITLE[jenis]}</h1>
        <p className="text-[11.5px] font-semibold text-muted-foreground">{formatMonth(month)}</p>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        <div className="flex gap-1 rounded-2xl border border-border bg-card p-1">
          {JENIS_VALUES.map((j) => (
            <Link
              key={j}
              href={`/buku/pengeluaran?jenis=${j}`}
              className={cn(
                "flex-1 rounded-xl px-2 py-2.5 text-center text-[12px] font-bold",
                j === jenis ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {PILL_LABEL[j]}
            </Link>
          ))}
        </div>

        <EntryForm
          jenis={jenis}
          cashAccounts={cashAccountsMapped}
          categories={categoriesMapped}
          action={recordPengeluaran}
          saldoAwalEmpty={saldoAwalEmpty}
        />

        <EntryList
          jenis={jenis}
          cashAccounts={cashAccountsMapped}
          rows={jenis === "belanja" ? belanjaRows : catatRowsMapped}
          month={formatMonth(month)}
        />
      </div>
    </AppShell>
  );
}
