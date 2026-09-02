"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Row, Tag } from "@/components/shell/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { formatRupiah } from "@/lib/format";
import { voidPengeluaran, voidCatat } from "@/app/actions/admin/keuangan";
import type { CatatSourceType } from "@/lib/accounting/catatRepository";
import type { JurnalRow } from "@/app/actions/admin/queries";
import {
  entryAmount,
  entryImbalance,
  isBalanced,
  JURNAL_FILTERS,
  FILTER_LABEL,
  SOURCE_LABEL,
  VOIDABLE_SOURCE_TYPES,
  matchesJurnalFilter,
  type JurnalFilter,
} from "./totals";

function sourceLabel(sourceType: string | null): string | null {
  if (sourceType === null) return null;
  return SOURCE_LABEL[sourceType] ?? sourceType;
}

/**
 * The detail view (mockup 7), expanded inline below its row rather than a
 * sheet or a /buku/jurnal/[id] route. shell/sheet.tsx has no generic
 * overlay primitive — only Segmented/NumKeypad/QuickCash/Dock — and
 * components/ui/sheet.tsx's Sheet is a hardcoded left-side nav drawer
 * ("Menu" header, fixed width), not a fit for entry detail. The spec's own
 * fallback ("if a sheet does not fit, expand the row inline") applies.
 */
function JurnalDetail({ entry }: { entry: JurnalRow }) {
  const router = useRouter();
  const { isPending, run } = useAdminAction();
  const confirm = useConfirm();

  const amount = entryAmount(entry.lines);
  const imbalance = entryImbalance(entry.lines);
  const balanced = isBalanced(entry.lines);
  const label = sourceLabel(entry.sourceType);

  const statusWord = entry.state === "VOID" ? "VOID" : balanced ? "SEIMBANG" : "TIDAK SEIMBANG";

  // Void is only wired for the five sourceTypes that have a real void action
  // (voidPengeluaran / voidCatat). shift-close (day-close) and settlement
  // have no generic void action — writing one is out of scope for this
  // rebuild, and a null sourceType (a manual "Penyesuaian" entry) has none
  // either. No Void control renders for those; this is a known gap, not an
  // oversight.
  const canVoid = entry.state !== "VOID" && VOIDABLE_SOURCE_TYPES.has(entry.sourceType ?? "");

  async function handleVoid() {
    if (!(await confirm({ title: "Hapus (void) entri ini?", destructive: true, confirmLabel: "Hapus" }))) return;
    run(async () => {
      if (entry.sourceType === "pengeluaran") {
        await voidPengeluaran(entry.id);
      } else {
        await voidCatat(entry.id, entry.sourceType as CatatSourceType);
      }
      router.refresh();
    }, { successMessage: "Entri dihapus" });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card-2 p-3.5">
      <div>
        <p className="font-display text-[26px] font-bold tabular-nums">{formatRupiah(amount)}</p>
        <p className="text-[11.5px] font-semibold text-muted-foreground">
          #{entry.number ?? "—"} · {statusWord}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-3.5">
        <p className="text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">
          {entry.date}{label ? ` · ${label}` : ""}
        </p>
        <div className="mt-2 flex flex-col divide-y divide-border">
          {entry.lines.map((l, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 text-[12.5px]">
              <span className="font-mono text-muted-foreground">
                {l.amount >= 0 ? "Dr" : "Cr"} · {l.account}
              </span>
              <span className="tabular-nums font-semibold">{formatRupiah(Math.abs(l.amount))}</span>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1.5 text-[12.5px] font-bold">
          <span>Selisih Dr − Cr</span>
          <span className={imbalance === 0 ? "tabular-nums text-success" : "tabular-nums text-destructive"}>
            {imbalance}
          </span>
        </div>
      </div>

      {/* No "Sumber" drill-down here: JurnalRow carries no author, no
          timestamp and no source-document id, so there is nothing to show
          beyond the source label already in the card header above. Building
          the mockup's "dicatat Kasir Dina 17:10 · Buka →" line would need a
          query this rebuild does not have and is not adding. */}

      {canVoid && (
        <Button size="sm" variant="destructive" disabled={isPending} onClick={handleVoid}>
          Void
        </Button>
      )}
    </div>
  );
}

export function JurnalClient({ entries }: { entries: JurnalRow[] }) {
  const [filter, setFilter] = useState<JurnalFilter>("semua");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(
    () => entries.filter((e) => matchesJurnalFilter(filter, e)),
    [entries, filter],
  );

  return (
    <>
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1">
        {JURNAL_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={
              "shrink-0 rounded-xl px-3 py-2.5 text-[12px] font-bold " +
              (f === filter ? "bg-primary text-primary-foreground" : "text-muted-foreground")
            }
          >
            {FILTER_LABEL[f]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-[12.5px] font-semibold text-muted-foreground">
          Tidak ada entri jurnal untuk filter ini
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((e) => {
            const amount = entryAmount(e.lines);
            const balanced = isBalanced(e.lines);
            const label = sourceLabel(e.sourceType);
            const expanded = expandedId === e.id;
            return (
              <div key={e.id} className="flex flex-col gap-2">
                <button type="button" className="text-left" onClick={() => setExpandedId(expanded ? null : e.id)}>
                  <Row
                    title={`#${e.number ?? "—"} · ${e.narration}`}
                    meta={`${e.date}${label ? ` · ${label}` : ""}`}
                  >
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-[13px] font-bold tabular-nums">{formatRupiah(amount)}</span>
                      <Tag tone={e.state === "VOID" ? "bad" : balanced ? "ok" : "bad"}>
                        {e.state === "VOID" ? "VOID" : balanced ? "Seimbang" : "Tidak seimbang"}
                      </Tag>
                    </div>
                  </Row>
                </button>
                {expanded && <JurnalDetail entry={e} />}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
