import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";
import { listJurnal } from "@/app/actions/admin/queries";
import { getSelectedMonth, monthRange } from "@/lib/keuangan-month";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  pengeluaran: "Pengeluaran",
  transfer: "Transfer",
  modal: "Modal",
  prive: "Prive",
  "saldo-awal": "Saldo Awal",
};

export default async function JurnalPage() {
  const { dateFrom, dateTo } = monthRange(await getSelectedMonth());
  const entries = await listJurnal({ dateFrom, dateTo });

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{entries.length} entri jurnal</p>

      {entries.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Belum ada entri jurnal bulan ini
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => {
            const balanced = e.lines.reduce((s, l) => s + l.amount, 0) === 0;
            return (
              <div key={e.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{e.narration}</p>
                    <p className="text-xs text-muted-foreground">
                      #{e.number ?? "—"} &middot; {e.date}
                      {e.sourceType && ` · ${SOURCE_LABEL[e.sourceType] ?? e.sourceType}`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                      balanced ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {balanced ? "Seimbang" : "Tidak seimbang"}
                  </span>
                </div>
                <div className="mt-2 divide-y divide-foreground/5">
                  {e.lines.map((l, i) => (
                    <div key={i} className="flex items-center justify-between py-1 text-xs">
                      <span className="font-mono text-muted-foreground">{l.account}</span>
                      <span className="tabular-nums">
                        {l.amount >= 0 ? "D " : "K "}
                        {formatRupiah(Math.abs(l.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
