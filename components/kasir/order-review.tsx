"use client";

import { useState } from "react";
import {
  useOrderItems,
  useTransaction,
  removeOrderItem,
  updateOrderItemStatus,
  updateOrderItemQty,
} from "@/hooks/use-session-store";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { calcSubtotal, getStatusColor, getStatusLabel } from "@/lib/kasir-utils";
import { KasirTopBar, BottomBar, Badge, QtyControl, EmptyState } from "./ui";
import { Button } from "@/components/ui/button";
import { X, ClipboardList, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrderItem, OrderItemStatus } from "@/lib/db";
import { ReceiptPreview } from "./receipt-preview";

const nextStatus: Partial<Record<OrderItemStatus, OrderItemStatus>> = {
  PENDING: "PREPARING",
  PREPARING: "SERVED",
};

export function OrderReview({
  sessionId,
  onBack,
  onPay,
  onHome,
  readOnly,
}: {
  sessionId: string;
  onBack: () => void;
  onPay?: () => void;
  onHome?: () => void;
  readOnly?: boolean;
}) {
  const items = useOrderItems(sessionId);
  const tx = useTransaction(readOnly ? sessionId : null);
  const activeItems = items?.filter((i) => i.status !== "CANCELLED") ?? [];
  const cancelledItems = items?.filter((i) => i.status === "CANCELLED") ?? [];
  const subtotal = calcSubtotal(items ?? []);
  const [showChecklist, setShowChecklist] = useState(false);

  return (
    <>
      <KasirTopBar title={readOnly ? "Detail Pesanan" : "Pesanan"} onBack={onBack} onHome={onHome}>
        <button type="button" onClick={() => setShowChecklist(true)} className="p-1">
          <Printer className="size-5 text-muted-foreground" />
        </button>
      </KasirTopBar>

      {/* Transaction summary for read-only (history) */}
      {readOnly && tx && (
        <div className="border-b bg-primary/5 px-3 py-2 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-bold">{formatRupiah(tx.totalAmount)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{tx.paymentMethod === "CASH" ? "Tunai" : "QRIS"}</span>
            <span>{formatDateTime(tx.paidAt, "short")}</span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {activeItems.length === 0 && cancelledItems.length === 0 ? (
          <EmptyState message="Belum ada pesanan" icon={ClipboardList} />
        ) : (
          <>
            {activeItems.map((item) => (
              <OrderItemRow key={item.id} item={item} readOnly={readOnly} />
            ))}

            {cancelledItems.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground pt-2">Dibatalkan</p>
                {cancelledItems.map((item) => (
                  <OrderItemRow key={item.id} item={item} readOnly={readOnly} />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {!readOnly && activeItems.length > 0 && onPay && (
        <BottomBar>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="text-lg font-bold">{formatRupiah(subtotal)}</span>
          </div>
          <Button size="lg" className="w-full" onClick={onPay}>
            Bayar
          </Button>
        </BottomBar>
      )}

      {showChecklist && (
        <ReceiptPreview
          sessionId={sessionId}
          mode="checklist"
          onClose={() => setShowChecklist(false)}
        />
      )}
    </>
  );
}

function OrderItemRow({ item, readOnly }: { item: OrderItem; readOnly?: boolean }) {
  const isCancelled = item.status === "CANCELLED";
  const isPending = item.status === "PENDING";
  const next = nextStatus[item.status];

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 space-y-2",
        isCancelled && "opacity-50"
      )}
    >
      {/* Name + Status + Remove */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium", isCancelled && "line-through")}>
            {item.nameSnapshot}
          </p>
          {item.note && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {item.note}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge className={getStatusColor(item.status)}>
            {getStatusLabel(item.status)}
          </Badge>
          {!readOnly && isPending && (
            <button
              type="button"
              onClick={() => removeOrderItem(item.id)}
              className="p-0.5 text-destructive hover:bg-destructive/10 rounded"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Qty + Price + Status action */}
      {!isCancelled && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!readOnly && isPending ? (
              <QtyControl
                qty={item.qty}
                onDecrease={() => updateOrderItemQty(item.id, Math.max(1, item.qty - 1))}
                onIncrease={() => updateOrderItemQty(item.id, item.qty + 1)}
              />
            ) : (
              <span className="text-xs text-muted-foreground">{item.qty}x</span>
            )}
            <span className="text-sm">{formatRupiah(item.price * item.qty)}</span>
          </div>

          <div className="flex gap-1.5">
            {next && (
              <Button
                size="xs"
                variant="outline"
                onClick={() => updateOrderItemStatus(item.id, next)}
              >
                {getStatusLabel(next)}
              </Button>
            )}
            {!isCancelled && item.status !== "SERVED" && (
              <Button
                size="xs"
                variant="destructive"
                onClick={() => updateOrderItemStatus(item.id, "CANCELLED")}
              >
                Batal
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
