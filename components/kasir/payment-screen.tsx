"use client";

import { useState } from "react";
import { useOrderItems, recordPayment, checkAndFinalizeSession, useTransactionForGroup } from "@/hooks/use-session-store";
import { formatRupiah } from "@/lib/format";
import {
  calcSubtotal,
  calcChange,
  calcChargeAmount,
  type ChargeInput,
} from "@/lib/kasir-utils";
import { KasirTopBar, BottomBar, NumericKeypad } from "./ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner } from "@/components/shared/ui";
import { cn } from "@/lib/utils";
import { CheckCircle, Loader2, ChevronDown, Smartphone } from "lucide-react";
import type { PaymentMethod } from "@/lib/db";
import { ReceiptPreview } from "./receipt-preview";
import type { StoreInfo } from "@/lib/settings";

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Tunai" },
  { value: "QRIS", label: "QRIS" },
  { value: "SPLIT", label: "Split" },
];

export function PaymentScreen({
  sessionId,
  staffId,
  staffName,
  staffRole,
  storeInfo,
  defaultTaxPct = 0,
  defaultServicePct = 0,
  splitGroup,
  splitTotalGroups,
  onDone,
  onBack,
  onHome,
}: {
  sessionId: string;
  staffId: string;
  staffName: string;
  staffRole?: string;
  storeInfo: StoreInfo;
  defaultTaxPct?: number;
  defaultServicePct?: number;
  /** When set, only pays for items in this splitGroup (1-based). */
  splitGroup?: number;
  splitTotalGroups?: number;
  onDone: () => void;
  onBack: () => void;
  onHome?: () => void;
}) {
  const items = useOrderItems(sessionId);
  const existingGroupTx = useTransactionForGroup(sessionId, splitGroup ?? 0);
  const activeItems = (items ?? []).filter((i) => {
    if (i.status === "CANCELLED") return false;
    if (splitGroup !== undefined) return i.splitGroup === splitGroup;
    return true;
  });
  const subtotal = calcSubtotal(activeItems);

  const canEditCharges = staffRole === "OWNER" || staffRole === "MANAGER";

  const [method, setMethod] = useState<PaymentMethod>("CASH");

  // Charge fields with mode toggle
  const [taxInput, setTaxInput] = useState(defaultTaxPct > 0 ? String(defaultTaxPct) : "0");
  const [taxMode, setTaxMode] = useState<"pct" | "abs">("pct");
  const [serviceInput, setServiceInput] = useState(defaultServicePct > 0 ? String(defaultServicePct) : "0");
  const [serviceMode, setServiceMode] = useState<"pct" | "abs">("pct");
  const [discountInput, setDiscountInput] = useState("");
  const [discountMode, setDiscountMode] = useState<"pct" | "abs">("abs");

  const [cashInput, setCashInput] = useState("");
  const [showKeypad, setShowKeypad] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [sessionFinalized, setSessionFinalized] = useState(false);

  // QRIS flow state
  const [qrisStep, setQrisStep] = useState<"idle" | "confirming">("idle");

  if (splitGroup !== undefined && existingGroupTx && !done) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12">
        <CheckCircle className="size-16 text-primary" />
        <p className="text-lg font-semibold">Sudah Dibayar</p>
        <p className="text-sm text-muted-foreground">Orang {splitGroup} sudah membayar {formatRupiah(existingGroupTx.totalAmount)}</p>
        <Button onClick={onDone}>Kembali</Button>
      </div>
    );
  }

  // Build charge inputs
  const taxCharge: ChargeInput = { value: parseFloat(taxInput) || 0, mode: taxMode };
  const serviceCharge: ChargeInput = { value: parseFloat(serviceInput) || 0, mode: serviceMode };
  const discountCharge: ChargeInput = { value: parseFloat(discountInput) || 0, mode: discountMode };

  const taxAmount = canEditCharges ? calcChargeAmount(subtotal, taxCharge) : 0;
  const serviceAmount = canEditCharges ? calcChargeAmount(subtotal, serviceCharge) : 0;
  const discountAmount = canEditCharges ? calcChargeAmount(subtotal, discountCharge) : 0;
  const total = subtotal + taxAmount + serviceAmount - discountAmount;

  const cashAmount = (method === "CASH" || method === "SPLIT") ? parseInt(cashInput) || 0 : 0;
  const qrisAmount = method === "SPLIT" ? Math.max(0, total - cashAmount) : 0;
  const change = method === "CASH" ? calcChange(cashAmount, total) : 0;

  const isValid =
    total > 0 &&
    activeItems.length > 0 &&
    (method === "QRIS" || (method === "CASH" && cashAmount >= total) || (method === "SPLIT" && cashAmount > 0 && cashAmount < total));

  // Quick cash amounts
  const quickAmounts = (() => {
    if (total <= 0) return [];
    const amounts = [
      { label: "Uang Pas", value: total },
      { label: formatRupiah(Math.ceil(total / 5000) * 5000), value: Math.ceil(total / 5000) * 5000 },
      { label: formatRupiah(Math.ceil(total / 10000) * 10000), value: Math.ceil(total / 10000) * 10000 },
      { label: formatRupiah(Math.ceil(total / 20000) * 20000), value: Math.ceil(total / 20000) * 20000 },
      { label: formatRupiah(Math.ceil(total / 50000) * 50000), value: Math.ceil(total / 50000) * 50000 },
      { label: formatRupiah(Math.ceil(total / 100000) * 100000), value: Math.ceil(total / 100000) * 100000 },
    ];
    const seen = new Set<number>();
    return amounts.filter((a) => {
      if (seen.has(a.value)) return false;
      seen.add(a.value);
      return true;
    });
  })();


  const doRecordPayment = async () => {
    setProcessing(true);
    try {
      const isPayFirstMode = splitGroup !== undefined && splitTotalGroups === 0;
      const isLastSplitGroup = !isPayFirstMode && (
        splitGroup === undefined || splitTotalGroups === undefined || splitGroup >= splitTotalGroups
      );
      await recordPayment({
        tableSessionId: sessionId,
        processedById: staffId,
        cashierName: staffName,
        subtotal,
        taxAmount,
        serviceCharge: serviceAmount,
        discountAmount,
        totalAmount: total,
        cashAmount: method === "CASH" ? cashAmount : method === "SPLIT" ? cashAmount : 0,
        qrisAmount: method === "QRIS" ? total : method === "SPLIT" ? qrisAmount : 0,
        paymentMethod: method,
        splitGroup: splitGroup ?? 0,
        skipSessionPaidMark: isPayFirstMode || !isLastSplitGroup,
      });
      if (isPayFirstMode) {
        const finalized = await checkAndFinalizeSession(sessionId);
        if (finalized) setSessionFinalized(true);
      }
      setDone(true);
      setProcessing(false);
      setQrisStep("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses pembayaran.");
      setProcessing(false);
      setQrisStep("idle");
    }
  };

  const handlePay = async () => {
    if (processing) return;
    setError(null);

    if (!isValid && method !== "QRIS") return;
    if (method === "CASH") {
      await doRecordPayment();
    } else {
      // QRIS or SPLIT: show QRIS confirmation page
      setQrisStep("confirming");
    }
  };

  const handleQrisConfirm = async () => {
    await doRecordPayment();
  };

  const handleQrisCancel = () => {
    setQrisStep("idle");
  };

  // Success state
  if (done) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12">
        <CheckCircle className="size-16 text-primary" />
        <p className="text-lg font-semibold">Pembayaran Berhasil</p>
        <p className="text-sm text-muted-foreground">{formatRupiah(total)}</p>
        {method === "CASH" && change > 0 && (
          <p className="text-sm">Kembalian: <span className="font-bold text-primary">{formatRupiah(change)}</span></p>
        )}
        {method === "SPLIT" && (
          <div className="text-sm text-center space-y-0.5">
            <p>Tunai: <span className="font-bold">{formatRupiah(cashAmount)}</span></p>
            <p>QRIS: <span className="font-bold">{formatRupiah(qrisAmount)}</span></p>
          </div>
        )}
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={() => setShowReceipt(true)}>
            Lihat Struk
          </Button>
          <Button onClick={sessionFinalized && onHome ? onHome : onDone}>
            Selesai
          </Button>
        </div>
        {showReceipt && (
          <ReceiptPreview
            sessionId={sessionId}
            mode="receipt"
            cashierName={staffName}
            storeInfo={storeInfo}
            splitGroup={splitGroup}
            splitTotalGroups={splitTotalGroups}
            onClose={() => setShowReceipt(false)}
          />
        )}
      </div>
    );
  }

  // QRIS instruction & confirmation page
  if (qrisStep === "confirming") {
    const qrisPayAmount = method === "SPLIT" ? qrisAmount : total;
    return (
      <>
        <KasirTopBar title={method === "SPLIT" ? "Pembayaran QRIS (Split)" : "Pembayaran QRIS"} onBack={handleQrisCancel} />
        <div className="flex flex-1 flex-col items-center gap-6 px-4 py-8">
          <div className="flex size-20 items-center justify-center rounded-full bg-primary/10">
            <Smartphone className="size-10 text-primary" />
          </div>

          <div className="text-center space-y-1">
            <p className="text-lg font-semibold">Selesaikan pembayaran di aplikasi QRIS</p>
          </div>

          <div className="w-full max-w-xs rounded-xl bg-primary/5 px-4 py-3 text-center">
            {method === "SPLIT" && (
              <p className="text-xs text-muted-foreground mb-1">Tunai: {formatRupiah(cashAmount)}</p>
            )}
            <p className="text-xs text-muted-foreground">{method === "SPLIT" ? "Sisa via QRIS" : "Total Pembayaran"}</p>
            <p className="text-2xl font-bold">{formatRupiah(qrisPayAmount)}</p>
          </div>

          <div className="w-full max-w-xs space-y-3 text-sm">
            <p className="font-medium">Langkah:</p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Buka aplikasi QRIS Anda</li>
              <li>Pastikan jumlah pembayaran sesuai: <span className="font-semibold text-foreground">{formatRupiah(qrisPayAmount)}</span></li>
              <li>Proses pembayaran di aplikasi</li>
              <li>Verifikasi pembayaran berhasil sebelum menekan tombol di bawah</li>
            </ol>
          </div>

          <div className="w-full max-w-xs space-y-2 mt-auto">
            <Button className="w-full" size="lg" onClick={handleQrisConfirm} disabled={processing}>
              {processing ? (
                <><Loader2 className="size-4 animate-spin mr-2" /> Memproses...</>
              ) : (
                <><CheckCircle className="size-4 mr-2" /> Pembayaran Sudah Diterima</>
              )}
            </Button>
            <Button variant="ghost" className="w-full" onClick={handleQrisCancel} disabled={processing}>
              Batal
            </Button>
          </div>

          <ErrorBanner error={error} />
        </div>
      </>
    );
  }

  return (
    <>
      <KasirTopBar
        title={splitGroup !== undefined ? `Pembayaran — Orang ${splitGroup}${splitTotalGroups ? `/${splitTotalGroups}` : ""}` : "Pembayaran"}
        onBack={onBack}
        onHome={onHome}
      />

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Total (BIG) at top */}
        <div className="rounded-xl bg-primary/5 px-4 py-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total</p>
          <p className="text-3xl font-bold">{formatRupiah(total)}</p>
        </div>

        {/* Breakdown */}
        <div className="rounded-lg border bg-card p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal ({activeItems.length} item)</span>
            <span>{formatRupiah(subtotal)}</span>
          </div>
          {taxAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Pajak{taxMode === "pct" ? ` (${taxCharge.value}%)` : ""}
              </span>
              <span>+{formatRupiah(taxAmount)}</span>
            </div>
          )}
          {serviceAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Service{serviceMode === "pct" ? ` (${serviceCharge.value}%)` : ""}
              </span>
              <span>+{formatRupiah(serviceAmount)}</span>
            </div>
          )}
          {discountAmount > 0 && (
            <div className="flex justify-between text-primary">
              <span>
                Diskon{discountMode === "pct" ? ` (${discountCharge.value}%)` : ""}
              </span>
              <span>-{formatRupiah(discountAmount)}</span>
            </div>
          )}
        </div>

        {/* Charge fields (only for OWNER/MANAGER) */}
        {canEditCharges && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <ChargeField
                label="Pajak"
                value={taxInput}
                onChange={setTaxInput}
                mode={taxMode}
                onToggleMode={() => setTaxMode((m) => m === "pct" ? "abs" : "pct")}
                subtotal={subtotal}
              />
              <ChargeField
                label="Service"
                value={serviceInput}
                onChange={setServiceInput}
                mode={serviceMode}
                onToggleMode={() => setServiceMode((m) => m === "pct" ? "abs" : "pct")}
                subtotal={subtotal}
              />
            </div>
            <ChargeField
              label="Diskon"
              value={discountInput}
              onChange={setDiscountInput}
              mode={discountMode}
              onToggleMode={() => setDiscountMode((m) => m === "pct" ? "abs" : "pct")}
              subtotal={subtotal}
            />
          </div>
        )}

        {/* Payment method */}
        <div className="space-y-2">
          <Label className="text-xs">Metode Pembayaran</Label>
          <div className="grid grid-cols-3 gap-2">
            {paymentMethods.map((pm) => (
              <button
                key={pm.value}
                type="button"
                onClick={() => {
                  setMethod(pm.value);
                  setCashInput("");
                  setQrisStep("idle");
                }}
                className={cn(
                  "h-12 rounded-lg border text-xs font-medium transition-colors",
                  method === pm.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "bg-card text-muted-foreground"
                )}
              >
                {pm.label}
              </button>
            ))}
          </div>
        </div>

        {/* Split: cash portion + QRIS remainder */}
        {method === "SPLIT" && (
          <div className="space-y-3">
            <Label className="text-xs">Bagian Tunai</Label>
            <div className="grid grid-cols-3 gap-2">
              {quickAmounts.slice(0, 6).filter((qa) => qa.value < total).map((qa) => (
                <button
                  key={qa.value}
                  type="button"
                  onClick={() => { setCashInput(qa.value.toString()); setShowKeypad(false); }}
                  className={cn(
                    "h-11 rounded-lg border text-xs font-medium transition-colors",
                    cashAmount === qa.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "bg-card text-muted-foreground"
                  )}
                >
                  {qa.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowKeypad(!showKeypad)}
              className="flex w-full items-center justify-center gap-1 text-xs text-muted-foreground py-1"
            >
              Jumlah lain
              <ChevronDown className={cn("size-3 transition-transform", showKeypad && "rotate-180")} />
            </button>
            {showKeypad && (
              <div className="space-y-2">
                <div className="rounded-lg border bg-card px-3 py-2 text-center text-lg font-bold">
                  {formatRupiah(parseInt(cashInput) || 0)}
                </div>
                <NumericKeypad value={cashInput} onChange={setCashInput} />
              </div>
            )}
            {cashAmount > 0 && cashAmount < total && (
              <div className="rounded-lg bg-primary/5 p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Tunai</span>
                  <span className="font-bold">{formatRupiah(cashAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>QRIS</span>
                  <span className="font-bold text-primary">{formatRupiah(qrisAmount)}</span>
                </div>
              </div>
            )}
            {cashAmount >= total && (
              <p className="text-xs text-destructive">Jumlah tunai melebihi total. Kurangi jumlah tunai.</p>
            )}
          </div>
        )}

        {/* Cash: Quick amount buttons */}
        {method === "CASH" && (
          <div className="space-y-3">
            <Label className="text-xs">Jumlah Tunai</Label>
            <div className="grid grid-cols-3 gap-2">
              {quickAmounts.map((qa) => (
                <button
                  key={qa.value}
                  type="button"
                  onClick={() => {
                    setCashInput(qa.value.toString());
                    setShowKeypad(false);
                  }}
                  className={cn(
                    "h-11 rounded-lg border text-xs font-medium transition-colors",
                    cashAmount === qa.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "bg-card text-muted-foreground"
                  )}
                >
                  {qa.label}
                </button>
              ))}
            </div>

            {cashAmount > 0 && (
              <div className="rounded-lg bg-primary/5 p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Dibayar</span>
                  <span className="font-bold">{formatRupiah(cashAmount)}</span>
                </div>
                {cashAmount >= total && (
                  <div className="flex justify-between text-sm">
                    <span>Kembalian</span>
                    <span className="font-bold text-primary">{formatRupiah(change)}</span>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowKeypad(!showKeypad)}
              className="flex w-full items-center justify-center gap-1 text-xs text-muted-foreground py-1"
            >
              Jumlah lain
              <ChevronDown className={cn("size-3 transition-transform", showKeypad && "rotate-180")} />
            </button>

            {showKeypad && (
              <div className="space-y-2">
                <div className="rounded-lg border bg-card px-3 py-2 text-center text-lg font-bold">
                  {formatRupiah(parseInt(cashInput) || 0)}
                </div>
                <NumericKeypad
                  value={cashInput}
                  onChange={setCashInput}
                />
              </div>
            )}
          </div>
        )}

        <ErrorBanner error={error} />
      </div>

      <BottomBar>
        <Button
          size="lg"
          className="w-full"
          onClick={handlePay}
          disabled={!isValid || processing}
        >
          {processing ? (
            <>
              <Loader2 className="size-4 animate-spin mr-2" />
              Memproses...
            </>
          ) : (
            `Proses Pembayaran — ${formatRupiah(total)}`
          )}
        </Button>
      </BottomBar>
    </>
  );
}

// ─── Charge Field Component ─────────────────────────────────────────────────

function ChargeField({
  label,
  value,
  onChange,
  mode,
  onToggleMode,
  subtotal,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mode: "pct" | "abs";
  onToggleMode: () => void;
  subtotal: number;
}) {
  const numValue = parseFloat(value) || 0;
  const computed = calcChargeAmount(subtotal, { value: numValue, mode });

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <button
          type="button"
          onClick={onToggleMode}
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
            "bg-muted text-muted-foreground hover:bg-accent"
          )}
        >
          {mode === "pct" ? "%" : "Rp"}
        </button>
      </div>
      <Input
        type="number"
        inputMode={mode === "pct" ? "decimal" : "numeric"}
        min={0}
        max={mode === "pct" ? 100 : undefined}
        step={mode === "pct" ? 0.5 : 1000}
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
      />
      {numValue > 0 && (
        <p className="text-[10px] text-muted-foreground">= {formatRupiah(computed)}</p>
      )}
    </div>
  );
}
