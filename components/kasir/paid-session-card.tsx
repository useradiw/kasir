"use client";

import { type TableSession } from "@/lib/db";
import { useTransactions } from "@/hooks/use-session-store";
import { formatRupiah, formatDateTime, formatPaymentMethod } from "@/lib/format";
import { Badge, SyncBadge } from "./ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Receipt } from "lucide-react";

export function PaidSessionCard({
  session,
  onClick,
  onReceipt,
  onSplitReceipt,
  onShowPicker,
}: {
  session: TableSession;
  onClick: () => void;
  onReceipt: () => void;
  onSplitReceipt: (group: number, total: number) => void;
  onShowPicker: () => void;
}) {
  const txs = useTransactions(session.id);
  const isErased = !!session.erasedAt && !session.paidAt;
  const isSplit = (txs ?? []).length > 1;
  const totalAmount = (txs ?? []).reduce((sum, t) => sum + t.totalAmount, 0);
  const firstTx = txs?.[0];

  return (
    <div
      className={cn("rounded-lg border bg-card p-3 min-h-14", !isErased && "cursor-pointer active:bg-accent transition-colors")}
      onClick={isErased ? undefined : onClick}
      role={isErased ? undefined : "button"}
      tabIndex={isErased ? undefined : 0}
      onKeyDown={isErased ? undefined : (e) => { if (e.key === "Enter") onClick(); }}
    >
      <div className="flex items-center justify-between">
        <span className={cn("font-medium text-sm", isErased && "text-muted-foreground")}>{session.name}</span>
        <div className="flex items-center gap-1.5">
          <SyncBadge synced={session.synced} />
          {isErased ? (
            <Badge className="bg-destructive/10 text-destructive">Dibatalkan</Badge>
          ) : firstTx ? (
            <>
              {isSplit && <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">Split</Badge>}
              <Badge className="bg-primary/10 text-primary">
                {formatRupiah(totalAmount)}
              </Badge>
            </>
          ) : null}
        </div>
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        {session.customerAlias && <span>{session.customerAlias}</span>}
        {session.customerPhone && <span>{session.customerPhone}</span>}
        {!isErased && firstTx && <span>{isSplit ? "Split" : formatPaymentMethod(firstTx.paymentMethod)}</span>}
        {isErased && session.erasedAt && <span>{formatDateTime(session.erasedAt, "short")}</span>}
        {!isErased && session.paidAt && <span>{formatDateTime(session.paidAt, "short")}</span>}
      </div>
      {!isErased && (
        <div className="mt-2 flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={isSplit ? onShowPicker : onReceipt}
          >
            <Receipt className="size-3 mr-1" />
            Struk
          </Button>
        </div>
      )}
    </div>
  );
}

export function SplitReceiptPicker({
  sessionId,
  onSelect,
  onUnified,
  onClose,
}: {
  sessionId: string;
  onSelect: (group: number, total: number) => void;
  onUnified: () => void;
  onClose: () => void;
}) {
  const txs = useTransactions(sessionId);
  const sortedTxs = (txs ?? []).filter((t) => t.splitGroup > 0).sort((a, b) => a.splitGroup - b.splitGroup);
  const totalGroups = sortedTxs.length;
  const totalAmount = (txs ?? []).reduce((sum, t) => sum + t.totalAmount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-72 rounded-lg bg-background p-4 space-y-3">
        <p className="text-sm font-semibold text-center">Pilih Struk</p>
        {sortedTxs.map((tx) => (
          <Button
            key={tx.splitGroup}
            variant="outline"
            className="w-full justify-between"
            onClick={() => onSelect(tx.splitGroup, totalGroups)}
          >
            <span>Orang {tx.splitGroup}</span>
            <span className="font-bold">{formatRupiah(tx.totalAmount)}</span>
          </Button>
        ))}
        <Button variant="outline" className="w-full justify-between" onClick={onUnified}>
          <span>Gabungan</span>
          <span className="font-bold">{formatRupiah(totalAmount)}</span>
        </Button>
        <Button variant="ghost" className="w-full" onClick={onClose}>
          Tutup
        </Button>
      </div>
    </div>
  );
}
