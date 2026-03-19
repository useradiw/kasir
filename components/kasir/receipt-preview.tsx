"use client";

import { useOrderItems, useTransaction } from "@/hooks/use-session-store";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { calcSubtotal, getStatusLabel } from "@/lib/kasir-utils";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function ReceiptPreview({
  sessionId,
  mode,
  onClose,
}: {
  sessionId: string;
  mode: "checklist" | "receipt";
  onClose: () => void;
}) {
  const items = useOrderItems(sessionId);
  const tx = useTransaction(sessionId);
  const session = useLiveQuery(
    () => db.table_sessions.get(sessionId),
    [sessionId]
  );

  const activeItems = items?.filter((i) => i.status !== "CANCELLED") ?? [];
  const cancelledItems = items?.filter((i) => i.status === "CANCELLED") ?? [];
  const subtotal = calcSubtotal(items ?? []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-[300px] max-h-[90vh] overflow-y-auto rounded-lg bg-white text-black p-5">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600"
        >
          <X className="size-4" />
        </button>

        {mode === "checklist" ? (
          <ChecklistContent
            session={session}
            activeItems={activeItems}
            cancelledItems={cancelledItems}
            subtotal={subtotal}
          />
        ) : (
          <ReceiptContent
            session={session}
            activeItems={activeItems}
            tx={tx}
            subtotal={subtotal}
          />
        )}

        <div className="mt-4">
          <Button size="sm" variant="outline" className="w-full text-black border-gray-300" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Checklist ────────────────────────────────────────────────────────────

function ChecklistContent({
  session,
  activeItems,
  cancelledItems,
  subtotal,
}: {
  session: { name: string; createdAt: string } | undefined;
  activeItems: { nameSnapshot: string; qty: number; note: string | null; status: string }[];
  cancelledItems: { nameSnapshot: string; qty: number }[];
  subtotal: number;
}) {
  return (
    <div className="font-mono text-xs space-y-2">
      <p className="text-center font-bold text-sm">CHECKLIST PESANAN</p>
      {session && (
        <div className="text-center text-gray-500">
          <p>{session.name}</p>
          <p>{formatDateTime(session.createdAt, "short")}</p>
        </div>
      )}

      <Divider />

      {activeItems.map((item, i) => (
        <div key={i}>
          <div className="flex justify-between">
            <span>{item.qty}x {item.nameSnapshot}</span>
            <span className="text-gray-500">[{getStatusLabel(item.status as any)}]</span>
          </div>
          {item.note && <p className="text-gray-400 ml-4">  {item.note}</p>}
        </div>
      ))}

      {cancelledItems.length > 0 && (
        <>
          <Divider />
          <p className="text-gray-400">Dibatalkan:</p>
          {cancelledItems.map((item, i) => (
            <div key={i} className="text-gray-400 line-through">
              {item.qty}x {item.nameSnapshot}
            </div>
          ))}
        </>
      )}

      <Divider />
      <div className="flex justify-between font-bold">
        <span>Subtotal</span>
        <span>{formatRupiah(subtotal)}</span>
      </div>
    </div>
  );
}

// ─── Receipt ──────────────────────────────────────────────────────────────

function ReceiptContent({
  session,
  activeItems,
  tx,
  subtotal,
}: {
  session: { name: string; paidAt: string | null } | undefined;
  activeItems: { nameSnapshot: string; qty: number; price: number }[];
  tx: { subtotal: number; taxAmount: number; serviceCharge: number; discountAmount: number; totalAmount: number; paymentMethod: string; cashAmount: number; qrisAmount: number; paidAt: string } | undefined;
  subtotal: number;
}) {
  return (
    <div className="font-mono text-xs space-y-2">
      <p className="text-center font-bold text-sm">STRUK PEMBAYARAN</p>
      {session && (
        <div className="text-center text-gray-500">
          <p>{session.name}</p>
          {tx && <p>{formatDateTime(tx.paidAt, "short")}</p>}
        </div>
      )}

      <Divider />

      {activeItems.map((item, i) => (
        <div key={i} className="flex justify-between">
          <span>{item.qty}x {item.nameSnapshot}</span>
          <span>{formatRupiah(item.price * item.qty)}</span>
        </div>
      ))}

      <Divider />

      {tx ? (
        <>
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatRupiah(tx.subtotal)}</span>
          </div>
          {tx.taxAmount > 0 && (
            <div className="flex justify-between">
              <span>Pajak</span>
              <span>+{formatRupiah(tx.taxAmount)}</span>
            </div>
          )}
          {tx.serviceCharge > 0 && (
            <div className="flex justify-between">
              <span>Service</span>
              <span>+{formatRupiah(tx.serviceCharge)}</span>
            </div>
          )}
          {tx.discountAmount > 0 && (
            <div className="flex justify-between">
              <span>Diskon</span>
              <span>-{formatRupiah(tx.discountAmount)}</span>
            </div>
          )}

          <Divider />

          <div className="flex justify-between font-bold text-sm">
            <span>TOTAL</span>
            <span>{formatRupiah(tx.totalAmount)}</span>
          </div>

          <Divider />

          <div className="flex justify-between">
            <span>Metode</span>
            <span>{tx.paymentMethod === "CASH" ? "Tunai" : "QRIS"}</span>
          </div>
          {tx.paymentMethod === "CASH" && (
            <>
              <div className="flex justify-between">
                <span>Dibayar</span>
                <span>{formatRupiah(tx.cashAmount)}</span>
              </div>
              {tx.cashAmount > tx.totalAmount && (
                <div className="flex justify-between">
                  <span>Kembalian</span>
                  <span>{formatRupiah(tx.cashAmount - tx.totalAmount)}</span>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <div className="flex justify-between font-bold">
          <span>Subtotal</span>
          <span>{formatRupiah(subtotal)}</span>
        </div>
      )}

      <Divider />
      <p className="text-center text-gray-400">Terima Kasih</p>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-dashed border-gray-300 my-1" />;
}
