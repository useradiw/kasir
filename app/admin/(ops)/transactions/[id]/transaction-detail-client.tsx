"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminSelect } from "@/components/admin/ui";
import { BentoCard, CardLabel } from "@/components/shell/ui";
import { formatRupiah, formatDateTime, formatPaymentMethod, formatTransactionShortId } from "@/lib/format";
import type { StoreInfo } from "@/lib/settings";
import { useAdminAction } from "@/hooks/use-admin-action";
import { updateTransaction } from "@/app/actions/admin/transactions";
import type { TransactionDetail } from "@/app/actions/admin/queries";
import { ArrowLeft, Pencil, Download, Printer, Save, X, Loader2 } from "lucide-react";
import { useBluetoothPrinter } from "@/hooks/use-bluetooth-printer";
import { buildReceipt } from "@/lib/escpos";

const serviceOptions = [
  { value: "", label: "Dine In" },
  { value: "GoFood", label: "GoFood" },
  { value: "ShopeeFood", label: "ShopeeFood" },
  { value: "GrabFood", label: "GrabFood" },
  { value: "Take_Away", label: "Bawa Pulang" },
];

export default function TransactionDetailClient({
  data,
  isOwner,
  storeInfo,
}: {
  data: TransactionDetail;
  isOwner: boolean;
  storeInfo: StoreInfo;
}) {
  const router = useRouter();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const { isPending, run, error, setError } = useAdminAction();
  const { isSupported, isConnected, connect, print, printing, error: printError } = useBluetoothPrinter();

  // Editable state
  const [customerAlias, setCustomerAlias] = useState(data.session.customerAlias ?? "");
  const [customerPhone, setCustomerPhone] = useState(data.session.customerPhone ?? "");
  const [service, setService] = useState(data.session.service ?? "");
  const [externalOrderId, setExternalOrderId] = useState(data.session.externalOrderId ?? "");
  const [orderItems, setOrderItems] = useState(
    data.orderItems.map((oi) => ({ ...oi }))
  );
  const [taxAmount, setTaxAmount] = useState(data.taxAmount);
  const [serviceCharge, setServiceCharge] = useState(data.serviceCharge);
  const [discountAmount, setDiscountAmount] = useState(data.discountAmount);
  const [paymentMethod, setPaymentMethod] = useState(data.paymentMethod);

  // Live recalculation
  const activeItems = orderItems.filter((oi) => oi.status !== "CANCELLED");
  const subtotal = activeItems.reduce((sum, oi) => sum + oi.qty * oi.price, 0);
  const totalAmount = subtotal + taxAmount + serviceCharge - discountAmount;

  function resetForm() {
    setCustomerAlias(data.session.customerAlias ?? "");
    setCustomerPhone(data.session.customerPhone ?? "");
    setService(data.session.service ?? "");
    setExternalOrderId(data.session.externalOrderId ?? "");
    setOrderItems(data.orderItems.map((oi) => ({ ...oi })));
    setTaxAmount(data.taxAmount);
    setServiceCharge(data.serviceCharge);
    setDiscountAmount(data.discountAmount);
    setPaymentMethod(data.paymentMethod);
    setError(null);
  }

  async function handleSave() {
    await run(() =>
      updateTransaction(data.id, {
        customerAlias: customerAlias.trim() || null,
        customerPhone: customerPhone.trim() || null,
        service: service || null,
        externalOrderId: externalOrderId.trim() || null,
        paymentMethod,
        orderItems: orderItems.map((oi) => ({
          id: oi.id,
          qty: oi.qty,
          price: oi.price,
          note: oi.note,
        })),
        taxAmount,
        serviceCharge,
        discountAmount,
      })
    );
    setEditing(false);
    router.refresh();
  }

  async function handleDownload() {
    if (!receiptRef.current) return;
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(receiptRef.current, {
      backgroundColor: "#ffffff",
      scale: 2,
    });
    const link = document.createElement("a");
    link.download = `struk-${data.session.name}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  async function handlePrint() {
    if (!isSupported) return;
    const printServiceLabel =
      serviceOptions.find((o) => o.value === (data.session.service ?? ""))?.label ?? "Dine In";
    const receiptData = buildReceipt({
      sessionName: data.session.name,
      cashierName: data.processedBy ?? "-",
      customerAlias: data.session.customerAlias ?? null,
      customerPhone: data.session.customerPhone ?? null,
      serviceLabel: printServiceLabel,
      paidAt: data.paidAt,
      items: data.orderItems
        .filter((oi) => oi.status !== "CANCELLED")
        .map((oi) => ({ nameSnapshot: oi.nameSnapshot, qty: oi.qty, price: oi.price })),
      subtotal: data.subtotal,
      taxAmount: data.taxAmount,
      serviceCharge: data.serviceCharge,
      discountAmount: data.discountAmount,
      totalAmount: data.totalAmount,
      paymentMethod: data.paymentMethod as "CASH" | "QRIS" | "SPLIT",
      cashAmount: data.cashAmount,
      qrisAmount: data.qrisAmount,
      isPaid: data.status === "PAID",
      isOnline: data.paymentMethod === "PENDING",
    }, storeInfo);
    if (!isConnected) await connect();
    await print(receiptData);
  }

  const serviceLabel = serviceOptions.find((o) => o.value === (service || ""))?.label ?? "Dine In";
  const isPaid = data.status === "PAID";

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Button variant="outline" size="sm" render={<Link href="/admin/transactions" />}>
            <ArrowLeft className="size-4" />
            Kembali
          </Button>
          <div className="min-w-0">
            <h1 className="font-display truncate text-[17px] font-bold">{data.session.name}</h1>
            <span
              className="font-mono text-[10px] text-muted-foreground"
              title={data.id}
            >
              {formatTransactionShortId(data.id)}
            </span>
          </div>
        </div>
        {isOwner && (
          <div className="flex shrink-0 items-center gap-2">
            {!editing ? (
              <Button size="sm" onClick={() => setEditing(true)}>
                <Pencil className="size-4" />
                Edit
              </Button>
            ) : (
              <>
                <Button size="sm" onClick={handleSave} disabled={isPending}>
                  <Save className="size-4" />
                  Simpan
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setEditing(false);
                  }}
                >
                  <X className="size-4" />
                  Batal
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/35 bg-destructive-soft p-3.5 text-[12.5px] font-semibold text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {/* Receipt Preview */}
        <BentoCard className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <CardLabel>Struk</CardLabel>
            <div className="flex gap-2">
              {isSupported && (
                <Button size="sm" variant="outline" onClick={handlePrint} disabled={printing}>
                  {printing ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Printer className="size-3" />
                  )}
                  Cetak
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleDownload}>
                <Download className="size-3" />
                Unduh
              </Button>
            </div>
          </div>
          {printError && (
            <p className="text-xs text-destructive">{printError}</p>
          )}
          <div className="flex justify-center">
              <div
                ref={receiptRef}
                className="w-75 bg-white text-black p-4 font-mono text-xs space-y-2"
              >
                {/* Store header */}
                <div className="text-center">
                  <p className="font-bold text-base">{storeInfo.name}</p>
                  <p className="text-gray-500">{storeInfo.address}</p>
                  {storeInfo.phone && <p className="text-gray-500">Telp: {storeInfo.phone}</p>}
                  {storeInfo.instagram && <p className="text-gray-500">IG: {storeInfo.instagram}</p>}
                </div>

                <ReceiptDivider />

                {/* Session info */}
                <div>
                  <div className="flex justify-between">
                    <span>Kasir: {data.processedBy ?? "-"}</span>
                    <span className="font-medium">{serviceLabel}</span>
                  </div>
                  {(editing ? customerAlias : data.session.customerAlias) && (
                    <div>Pelanggan: {editing ? customerAlias : data.session.customerAlias}</div>
                  )}
                  {(editing ? customerPhone : data.session.customerPhone) && (
                    <div>HP: {editing ? customerPhone : data.session.customerPhone}</div>
                  )}
                  <div>{formatDateTime(data.paidAt, "short")}</div>
                </div>

                <ReceiptDivider />

                {/* Total (large) */}
                <div className="text-center py-1">
                  <p className="font-bold text-lg">
                    {formatRupiah(editing ? totalAmount : data.totalAmount)}
                  </p>
                </div>

                <ReceiptDivider />

                {/* Items */}
                {(editing ? activeItems : data.orderItems.filter((oi) => oi.status !== "CANCELLED")).map((item) => (
                  <div key={item.id}>
                    <div className="font-bold">{item.nameSnapshot}</div>
                    <div className="flex justify-between text-gray-500">
                      <span>&nbsp;&nbsp;{item.qty} x {formatRupiah(item.price)}</span>
                      <span>{formatRupiah(item.price * item.qty)}</span>
                    </div>
                  </div>
                ))}

                <ReceiptDivider />

                {/* Charges */}
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatRupiah(editing ? subtotal : data.subtotal)}</span>
                </div>
                {(editing ? taxAmount : data.taxAmount) > 0 && (
                  <div className="flex justify-between">
                    <span>Pajak</span>
                    <span>+{formatRupiah(editing ? taxAmount : data.taxAmount)}</span>
                  </div>
                )}
                {(editing ? serviceCharge : data.serviceCharge) > 0 && (
                  <div className="flex justify-between">
                    <span>Service</span>
                    <span>+{formatRupiah(editing ? serviceCharge : data.serviceCharge)}</span>
                  </div>
                )}
                {(editing ? discountAmount : data.discountAmount) > 0 && (
                  <div className="flex justify-between">
                    <span>Diskon</span>
                    <span>-{formatRupiah(editing ? discountAmount : data.discountAmount)}</span>
                  </div>
                )}

                <ReceiptDivider />

                {/* Payment method — hidden for online orders */}
                {data.paymentMethod !== "PENDING" && (
                  <>
                    <div className="flex justify-between">
                      <span>Metode</span>
                      <span>{formatPaymentMethod(data.paymentMethod)}</span>
                    </div>
                    {(data.paymentMethod === "CASH" || data.paymentMethod === "SPLIT") && (
                      <>
                        <div className="flex justify-between">
                          <span>Tunai</span>
                          <span>{formatRupiah(data.cashAmount)}</span>
                        </div>
                        {data.paymentMethod === "SPLIT" && (
                          <div className="flex justify-between">
                            <span>QRIS</span>
                            <span>{formatRupiah(data.qrisAmount)}</span>
                          </div>
                        )}
                        {data.paymentMethod === "CASH" && data.cashAmount > (editing ? totalAmount : data.totalAmount) && (
                          <div className="flex justify-between">
                            <span>Kembalian</span>
                            <span>{formatRupiah(data.cashAmount - (editing ? totalAmount : data.totalAmount))}</span>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* Payment status */}
                <ReceiptDivider />
                <p className={`text-center font-bold text-sm ${isPaid ? "text-green-600" : "text-red-600"}`}>
                  {isPaid ? "LUNAS" : data.status === "VOIDED" ? "VOID" : "Belum Dibayar"}
                </p>

                {/* Footer */}
                <ReceiptDivider />
                <p className="text-center text-gray-400 text-[10px] leading-tight whitespace-pre-line">
                  {storeInfo.receiptFooter}
                </p>
              </div>
          </div>
        </BentoCard>

        {/* Edit Form or Details */}
        <div className="flex flex-col gap-3">
          {/* Session Info */}
          <BentoCard className="flex flex-col gap-3">
            <CardLabel>Info Sesi</CardLabel>
              <div className="grid gap-1">
                <Label className="text-xs">Nama Pelanggan</Label>
                {editing ? (
                  <Input
                    value={customerAlias}
                    onChange={(e) => setCustomerAlias(e.target.value)}
                    placeholder="Nama pelanggan"
                    className="h-8 border-border bg-card-2 text-sm"
                  />
                ) : (
                  <p className="text-sm">{data.session.customerAlias || "-"}</p>
                )}
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">No. HP</Label>
                {editing ? (
                  <Input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="No. HP pelanggan"
                    className="h-8 border-border bg-card-2 text-sm"
                  />
                ) : (
                  <p className="text-sm">{data.session.customerPhone || "-"}</p>
                )}
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Layanan</Label>
                {editing ? (
                  <AdminSelect
                    value={service ?? ""}
                    onChange={(e) => setService(e.target.value)}
                    className="border-border bg-card-2"
                  >
                    {serviceOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </AdminSelect>
                ) : (
                  <p className="text-sm">{serviceLabel}</p>
                )}
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">ID Pesanan Eksternal</Label>
                {editing ? (
                  <Input
                    value={externalOrderId}
                    onChange={(e) => setExternalOrderId(e.target.value)}
                    placeholder="ID dari GoFood/Shopee/Grab"
                    className="h-8 border-border bg-card-2 text-sm"
                  />
                ) : (
                  <p className="text-sm">{data.session.externalOrderId || "-"}</p>
                )}
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Kasir</Label>
                <p className="text-sm">{data.processedBy ?? "-"}</p>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Metode Bayar</Label>
                {editing ? (
                  <AdminSelect
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="border-border bg-card-2"
                  >
                    <option value="CASH">Tunai</option>
                    <option value="QRIS">QRIS</option>
                    <option value="SPLIT">Split</option>
                    <option value="PENDING">Unsettled</option>
                  </AdminSelect>
                ) : (
                  <p className="text-sm">
                    {data.paymentMethod === "PENDING" && data.settlement
                      ? "Settled"
                      : formatPaymentMethod(data.paymentMethod)}
                  </p>
                )}
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Waktu Bayar</Label>
                <p className="text-sm">{formatDateTime(data.paidAt)}</p>
              </div>
              {data.settlement && (
                <div className="space-y-1 rounded-xl bg-primary-soft p-3 text-[12.5px]">
                  <p className="font-bold text-primary">Sudah Cair</p>
                  <p className="text-[11.5px] text-muted-foreground">
                    {formatDateTime(data.settlement.settlementDate)} · oleh {data.settlement.settledBy ?? "-"}
                  </p>
                  <div className="space-y-0.5 text-[11.5px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Komisi</span>
                      <span className="text-destructive tabular-nums">-{formatRupiah(data.settlement.commissionAmount)}</span>
                    </div>
                    {data.settlement.deductions.map((d) => (
                      <div key={d.id} className="flex justify-between">
                        <span className="text-muted-foreground">{d.label}</span>
                        <span className="text-destructive tabular-nums">-{formatRupiah(d.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-border pt-1 font-bold">
                      <span>Diterima</span>
                      <span className="text-primary tabular-nums">{formatRupiah(data.settlement.finalAmount)}</span>
                    </div>
                  </div>
                  {data.settlement.notes && (
                    <p className="text-[11px] italic text-muted-foreground">{data.settlement.notes}</p>
                  )}
                </div>
              )}
              {data.status === "VOIDED" && (
                <div className="space-y-1 rounded-xl bg-destructive-soft p-3 text-[12.5px]">
                  <p className="font-bold text-destructive">Transaksi di-void</p>
                  {data.voidReason && <p>Alasan: {data.voidReason}</p>}
                  {data.voidedBy && <p>Oleh: {data.voidedBy}</p>}
                  {data.voidedAt && <p>Waktu: {formatDateTime(data.voidedAt)}</p>}
                </div>
              )}
          </BentoCard>

          {/* Order Items */}
          <BentoCard className="flex flex-col gap-3">
            <CardLabel>Item Pesanan</CardLabel>
            <div className="flex flex-col gap-2">
              {orderItems.map((item, i) => (
                <div
                  key={item.id}
                  className={`space-y-1 rounded-xl border border-border p-2 text-[12.5px] ${item.status === "CANCELLED" ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{item.nameSnapshot}</span>
                    {item.status === "CANCELLED" && (
                      <span className="text-[11px] text-destructive">Dibatalkan</span>
                    )}
                  </div>
                  {editing && item.status !== "CANCELLED" ? (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Qty</Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(e) => {
                            const updated = [...orderItems];
                            updated[i] = { ...updated[i], qty: Math.max(1, parseInt(e.target.value) || 1) };
                            setOrderItems(updated);
                          }}
                          className="h-7 border-border bg-card-2 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Harga</Label>
                        <Input
                          type="number"
                          min={0}
                          value={item.price}
                          onChange={(e) => {
                            const updated = [...orderItems];
                            updated[i] = { ...updated[i], price: Math.max(0, parseInt(e.target.value) || 0) };
                            setOrderItems(updated);
                          }}
                          className="h-7 border-border bg-card-2 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Catatan</Label>
                        <Input
                          value={item.note ?? ""}
                          onChange={(e) => {
                            const updated = [...orderItems];
                            updated[i] = { ...updated[i], note: e.target.value || null };
                            setOrderItems(updated);
                          }}
                          placeholder="-"
                          className="h-7 border-border bg-card-2 text-xs"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between text-[11.5px] text-muted-foreground">
                      <span>{item.qty}x @ {formatRupiah(item.price)}</span>
                      <span className="tabular-nums">{formatRupiah(item.qty * item.price)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </BentoCard>

          {/* Charges */}
          <BentoCard className="flex flex-col gap-3">
            <CardLabel>Rincian Biaya</CardLabel>
            <div className="flex justify-between text-[12.5px]">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatRupiah(editing ? subtotal : data.subtotal)}</span>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Pajak</Label>
              {editing ? (
                <Input
                  type="number"
                  min={0}
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-8 border-border bg-card-2 text-sm"
                />
              ) : (
                <p className="text-[12.5px] tabular-nums">{formatRupiah(data.taxAmount)}</p>
              )}
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Service</Label>
              {editing ? (
                <Input
                  type="number"
                  min={0}
                  value={serviceCharge}
                  onChange={(e) => setServiceCharge(Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-8 border-border bg-card-2 text-sm"
                />
              ) : (
                <p className="text-[12.5px] tabular-nums">{formatRupiah(data.serviceCharge)}</p>
              )}
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Diskon</Label>
              {editing ? (
                <Input
                  type="number"
                  min={0}
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-8 border-border bg-card-2 text-sm"
                />
              ) : (
                <p className="text-[12.5px] tabular-nums">{formatRupiah(data.discountAmount)}</p>
              )}
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-[12.5px] font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatRupiah(editing ? totalAmount : data.totalAmount)}</span>
            </div>
          </BentoCard>
        </div>
      </div>
    </>
  );
}

function ReceiptDivider() {
  return <div className="border-t border-dashed border-gray-300 my-1" />;
}
