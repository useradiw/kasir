"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminSelect, ErrorBanner } from "@/components/admin/ui";
import { formatRupiah, formatDateTime, STORE_INFO } from "@/lib/format";
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
}: {
  data: TransactionDetail;
  isOwner: boolean;
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
  const [orderItems, setOrderItems] = useState(
    data.orderItems.map((oi) => ({ ...oi }))
  );
  const [taxAmount, setTaxAmount] = useState(data.taxAmount);
  const [serviceCharge, setServiceCharge] = useState(data.serviceCharge);
  const [discountAmount, setDiscountAmount] = useState(data.discountAmount);

  // Live recalculation
  const activeItems = orderItems.filter((oi) => oi.status !== "CANCELLED");
  const subtotal = activeItems.reduce((sum, oi) => sum + oi.qty * oi.price, 0);
  const totalAmount = subtotal + taxAmount + serviceCharge - discountAmount;

  function resetForm() {
    setCustomerAlias(data.session.customerAlias ?? "");
    setCustomerPhone(data.session.customerPhone ?? "");
    setService(data.session.service ?? "");
    setOrderItems(data.orderItems.map((oi) => ({ ...oi })));
    setTaxAmount(data.taxAmount);
    setServiceCharge(data.serviceCharge);
    setDiscountAmount(data.discountAmount);
    setError(null);
  }

  async function handleSave() {
    await run(() =>
      updateTransaction(data.id, {
        customerAlias: customerAlias.trim() || null,
        customerPhone: customerPhone.trim() || null,
        service: service || null,
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
      paymentMethod: data.paymentMethod as "CASH" | "QRIS",
      cashAmount: data.cashAmount,
      isPaid: data.status === "PAID",
    });
    if (!isConnected) await connect();
    await print(receiptData);
  }

  const serviceLabel = serviceOptions.find((o) => o.value === (service || ""))?.label ?? "Dine In";
  const isPaid = data.status === "PAID";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/transactions">
            <Button variant="outline" size="sm">
              <ArrowLeft className="size-4 mr-1" />
              Kembali
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{data.session.name}</h1>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2">
            {!editing ? (
              <Button size="sm" onClick={() => setEditing(true)}>
                <Pencil className="size-4 mr-1" />
                Edit
              </Button>
            ) : (
              <>
                <Button size="sm" onClick={handleSave} disabled={isPending}>
                  <Save className="size-4 mr-1" />
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
                  <X className="size-4 mr-1" />
                  Batal
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {error && <ErrorBanner error={error} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Receipt Preview */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between">
              <span>Struk</span>
              <div className="flex gap-2">
                {isSupported && (
                  <Button size="sm" variant="outline" onClick={handlePrint} disabled={printing}>
                    {printing ? (
                      <Loader2 className="size-3 mr-1 animate-spin" />
                    ) : (
                      <Printer className="size-3 mr-1" />
                    )}
                    Cetak
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={handleDownload}>
                  <Download className="size-3 mr-1" />
                  Unduh
                </Button>
              </div>
            </CardTitle>
            {printError && (
              <p className="text-xs text-red-500 mt-1">{printError}</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <div
                ref={receiptRef}
                className="w-[300px] bg-white text-black p-4 font-mono text-xs space-y-2"
              >
                {/* Store header */}
                <div className="text-center">
                  <p className="font-bold text-base">{STORE_INFO.name}</p>
                  <p className="text-gray-500">{STORE_INFO.address}</p>
                  <p className="text-gray-500">Telp: {STORE_INFO.phone}</p>
                  <p className="text-gray-500">IG: {STORE_INFO.instagram}</p>
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

                {/* Payment method */}
                <div className="flex justify-between">
                  <span>Metode</span>
                  <span>{data.paymentMethod === "CASH" ? "Tunai" : "QRIS"}</span>
                </div>
                {data.paymentMethod === "CASH" && (
                  <>
                    <div className="flex justify-between">
                      <span>Dibayar</span>
                      <span>{formatRupiah(data.cashAmount)}</span>
                    </div>
                    {data.cashAmount > (editing ? totalAmount : data.totalAmount) && (
                      <div className="flex justify-between">
                        <span>Kembalian</span>
                        <span>{formatRupiah(data.cashAmount - (editing ? totalAmount : data.totalAmount))}</span>
                      </div>
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
                <p className="text-center text-gray-400 text-[10px] leading-tight">
                  Terimakasih dan silahkan<br />datang kembali.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Edit Form or Details */}
        <div className="space-y-4">
          {/* Session Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Info Sesi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-1">
                <Label className="text-xs">Nama Pelanggan</Label>
                {editing ? (
                  <Input
                    value={customerAlias}
                    onChange={(e) => setCustomerAlias(e.target.value)}
                    placeholder="Nama pelanggan"
                    className="h-8 text-sm"
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
                    className="h-8 text-sm"
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
                <Label className="text-xs">Kasir</Label>
                <p className="text-sm">{data.processedBy ?? "-"}</p>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Waktu Bayar</Label>
                <p className="text-sm">{formatDateTime(data.paidAt)}</p>
              </div>
              {data.status === "VOIDED" && (
                <div className="rounded-lg bg-destructive/10 p-3 space-y-1 text-sm">
                  <p className="font-medium text-destructive">Transaksi di-void</p>
                  {data.voidReason && <p>Alasan: {data.voidReason}</p>}
                  {data.voidedBy && <p>Oleh: {data.voidedBy}</p>}
                  {data.voidedAt && <p>Waktu: {formatDateTime(data.voidedAt)}</p>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Item Pesanan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {orderItems.map((item, i) => (
                  <div
                    key={item.id}
                    className={`rounded-lg border p-2 space-y-1 text-sm ${item.status === "CANCELLED" ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{item.nameSnapshot}</span>
                      {item.status === "CANCELLED" && (
                        <span className="text-xs text-destructive">Dibatalkan</span>
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
                            className="h-7 text-xs"
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
                            className="h-7 text-xs"
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
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{item.qty}x @ {formatRupiah(item.price)}</span>
                        <span>{formatRupiah(item.qty * item.price)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Charges */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rincian Biaya</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatRupiah(editing ? subtotal : data.subtotal)}</span>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Pajak</Label>
                {editing ? (
                  <Input
                    type="number"
                    min={0}
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="h-8 text-sm"
                  />
                ) : (
                  <p className="text-sm">{formatRupiah(data.taxAmount)}</p>
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
                    className="h-8 text-sm"
                  />
                ) : (
                  <p className="text-sm">{formatRupiah(data.serviceCharge)}</p>
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
                    className="h-8 text-sm"
                  />
                ) : (
                  <p className="text-sm">{formatRupiah(data.discountAmount)}</p>
                )}
              </div>
              <div className="flex justify-between text-sm font-bold border-t pt-2">
                <span>Total</span>
                <span>{formatRupiah(editing ? totalAmount : data.totalAmount)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ReceiptDivider() {
  return <div className="border-t border-dashed border-gray-300 my-1" />;
}
