"use client";

import { useRef } from "react";
import { useOrderItems, useTransaction } from "@/hooks/use-session-store";
import { useBluetoothPrinter } from "@/hooks/use-bluetooth-printer";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { ServiceEnum } from "@/lib/db";
import { formatRupiah, formatDateTime } from "@/lib/format";
import type { StoreInfo } from "@/lib/settings";
import { calcSubtotal, getServiceLabel } from "@/lib/kasir-utils";
import { buildReceipt, buildChecklist } from "@/lib/escpos";
import { Button } from "@/components/ui/button";
import { X, Download, Printer, Loader2 } from "lucide-react";

export function ReceiptPreview({
  sessionId,
  mode,
  cashierName,
  storeInfo,
  onClose,
}: {
  sessionId: string;
  mode: "checklist" | "receipt";
  cashierName?: string;
  storeInfo: StoreInfo;
  onClose: () => void;
}) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const items = useOrderItems(sessionId);
  const tx = useTransaction(sessionId);
  const session = useLiveQuery(
    () => db.table_sessions.get(sessionId),
    [sessionId]
  );

  const { isConnected, isSupported, connect, print, printing, error: printError } = useBluetoothPrinter();

  const activeItems = items?.filter((i) => i.status !== "CANCELLED") ?? [];
  const subtotal = calcSubtotal(items ?? []);

  const resolvedCashierName = tx?.cashierName ?? cashierName ?? "-";
  const serviceLabel = getServiceLabel((session?.service as ServiceEnum) ?? null);
  const isPaid = tx?.status === "PAID";

  async function handlePrint() {
    if (!isConnected) await connect();
    const data =
      mode === "checklist"
        ? buildChecklist({
            sessionName: session?.name ?? "",
            createdAt: session?.createdAt ?? "",
            items: activeItems,
          })
        : buildReceipt({
            sessionName: session?.name ?? "",
            cashierName: resolvedCashierName,
            customerAlias: session?.customerAlias ?? null,
            customerPhone: session?.customerPhone,
            serviceLabel,
            paidAt: tx?.paidAt ?? "",
            items: activeItems,
            subtotal: tx?.subtotal ?? subtotal,
            taxAmount: tx?.taxAmount ?? 0,
            serviceCharge: tx?.serviceCharge ?? 0,
            discountAmount: tx?.discountAmount ?? 0,
            totalAmount: tx?.totalAmount ?? 0,
            paymentMethod: (tx?.paymentMethod as "CASH" | "QRIS") ?? "CASH",
            cashAmount: tx?.cashAmount ?? 0,
            isPaid,
          }, storeInfo);
    await print(data);
  }

  async function handleDownload() {
    if (!receiptRef.current) return;
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(receiptRef.current, {
      backgroundColor: "#ffffff",
      scale: 2,
    });
    const link = document.createElement("a");
    const name = session?.name ?? sessionId;
    link.download = `${mode === "checklist" ? "checklist" : "struk"}-${name}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-75 max-h-[90vh] overflow-y-auto rounded-lg bg-white text-black p-5">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600"
        >
          <X className="size-4" />
        </button>

        <div ref={receiptRef} className="bg-white p-2">
          {mode === "checklist" ? (
            <ChecklistContent
              session={session}
              activeItems={activeItems}
            />
          ) : (
            <ReceiptContent
              session={session}
              activeItems={activeItems}
              tx={tx}
              subtotal={subtotal}
              cashierName={resolvedCashierName}
              serviceLabel={serviceLabel}
              isPaid={isPaid}
              storeInfo={storeInfo}
            />
          )}
        </div>

        <div className="mt-4 flex gap-2">
          {isSupported && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-black border-gray-300"
              onClick={handlePrint}
              disabled={printing}
            >
              {printing ? (
                <Loader2 className="size-3 mr-1 animate-spin" />
              ) : (
                <Printer className="size-3 mr-1" />
              )}
              Cetak
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-black border-gray-300"
            onClick={handleDownload}
          >
            <Download className="size-3 mr-1" />
            Unduh
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-black border-gray-300"
            onClick={onClose}
          >
            Tutup
          </Button>
        </div>
        {printError && (
          <p className="mt-1 text-center text-xs text-red-500">{printError}</p>
        )}
      </div>
    </div>
  );
}

// ─── Checklist ────────────────────────────────────────────────────────────

function ChecklistContent({
  session,
  activeItems,
}: {
  session: { name: string; createdAt: string } | undefined;
  activeItems: { nameSnapshot: string; qty: number; note: string | null }[];
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
          <div>{item.qty}x {item.nameSnapshot}</div>
          {item.note && <p className="text-gray-400 ml-4">  {item.note}</p>}
        </div>
      ))}

      <Divider />
      <p className="text-center text-gray-500 font-bold">Bukan Nota</p>
    </div>
  );
}

// ─── Receipt ──────────────────────────────────────────────────────────────

function ReceiptContent({
  session,
  activeItems,
  tx,
  subtotal,
  cashierName,
  serviceLabel,
  isPaid,
  storeInfo,
}: {
  session: { name: string; paidAt: string | null; service: ServiceEnum | null; customerAlias: string | null } | undefined;
  activeItems: { nameSnapshot: string; qty: number; price: number }[];
  tx: { subtotal: number; taxAmount: number; serviceCharge: number; discountAmount: number; totalAmount: number; paymentMethod: string; cashAmount: number; qrisAmount: number; paidAt: string; status: string } | undefined;
  subtotal: number;
  cashierName: string;
  serviceLabel: string;
  isPaid: boolean;
  storeInfo: StoreInfo;
}) {
  return (
    <div className="font-mono text-xs space-y-2">
      {/* Store header */}
      <div className="text-center">
        <p className="font-bold text-base">{storeInfo.name}</p>
        <p className="text-gray-500">{storeInfo.address}</p>
        {storeInfo.phone && <p className="text-gray-500">Telp: {storeInfo.phone}</p>}
        {storeInfo.instagram && <p className="text-gray-500">IG: {storeInfo.instagram}</p>}
      </div>

      <Divider />

      {/* Cashier, customer, time, service */}
      <div>
        <div className="flex justify-between">
          <span>Kasir: {cashierName}</span>
          <span className="font-medium">{serviceLabel}</span>
        </div>
        {session?.name && <div>Meja: {session.name}</div>}
        {session?.customerAlias && (
          <div>Pelanggan: {session.customerAlias}</div>
        )}
        {tx && <div>{formatDateTime(tx.paidAt, "short")}</div>}
      </div>

      <Divider />

      {/* Total (large, centered) */}
      <div className="text-center py-1">
        <p className="font-bold text-lg">
          {formatRupiah(tx?.totalAmount ?? subtotal)}
        </p>
      </div>

      <Divider />

      {/* Order items */}
      {activeItems.map((item, i) => (
        <div key={i}>
          <div className="font-bold">{item.nameSnapshot}</div>
          <div className="flex justify-between text-gray-500">
            <span>&nbsp;&nbsp;{item.qty} x {formatRupiah(item.price)}</span>
            <span>{formatRupiah(item.price * item.qty)}</span>
          </div>
        </div>
      ))}

      <Divider />

      {/* Charges */}
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

      {/* Payment status */}
      <Divider />
      <p className={`text-center font-bold text-sm ${isPaid ? "text-green-600" : "text-red-600"}`}>
        {isPaid ? "LUNAS" : "Belum Dibayar"}
      </p>

      {/* Footer */}
      <Divider />
      <p className="text-center text-gray-400 text-[10px] leading-tight whitespace-pre-line">
        {storeInfo.receiptFooter}
      </p>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-dashed border-gray-300 my-1" />;
}
