"use client";

import { useState } from "react";
import { useOrderItems, recordPayment, checkAndFinalizeSession, useTransactionForGroup } from "@/hooks/use-session-store";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
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
import { useKasir } from "./kasir-context";

const ONLINE_SERVICES = ["GoFood", "ShopeeFood", "GrabFood"];

const basePaymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Tunai" },
  { value: "QRIS", label: "QRIS" },
  { value: "SPLIT", label: "Split" },
];

export function PaymentScreen({
  sessionId,
  splitGroup,
  splitTotalGroups,
  onDone,
  onBack,
  onHome,
}: {
  sessionId: string;
  /** When set, only pays for items in this splitGroup (1-based). */
  splitGroup?: number;
  splitTotalGroups?: number;
  onDone: () => void;
  onBack: () => void;
  onHome?: () => void;
}) {
  const { staffId, staffName, staffRole, defaultTaxPct, defaultServicePct } = useKasir();
  const items = useOrderItems(sessionId);
  const existingGroupTx = useTransactionForGroup(sessionId, splitGroup ?? 0);
  const session = useLiveQuery(() => db.table_sessions.get(sessionId), [sessionId]);
  const isOnlineSession = session?.service ? ONLINE_SERVICES.includes(session.service) : false;
  const paymentMethods = isOnlineSession
    ? [...basePaymentMethods, { value: "PENDING" as PaymentMethod, label: "Unsettled" }]
    : basePaymentMethods;
  const activeItems = (items ?? []).filter((i) => {
    if (i.status === "CANCELLED") return false;
    if (splitGroup !== undefined) return i.splitGroup === splitGroup;
    return true;
  });
  const subtotal = calcSubtotal(activeItems);

  const canEditCharges = staffRole === "OWNER" || staffRole === "MANAGER" || staffRole === "DEVELOPER";

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
    (method === "QRIS" || method === "PENDING" || (method === "CASH" && cashAmount >= total) || (method === "SPLIT" && cashAmount > 0 && cashAmount < total));

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

    if (!isValid && method !== "QRIS" && method !== "PENDING") return;
    if (method === "CASH") {
      await doRecordPayment();
    } else if (method === "PENDING") {
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
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12">
        <div className="grid size-20 place-items-center rounded-full bg-success-soft">
          <CheckCircle className="size-10 text-success" />
        </div>
        <p className="font-display text-[21px] font-bold tabular-nums">
          Lunas — {formatRupiah(total)}
        </p>
        {method === "CASH" && change > 0 && (
          <p className="text-[13px] font-semibold text-muted-foreground">
            Tunai · kembalian{" "}
            <span className="font-display font-bold tabular-nums text-primary">
              {formatRupiah(change)}
            </span>
          </p>
        )}
        {method === "SPLIT" && (
          <div className="space-y-0.5 text-center text-[13px] font-semibold text-muted-foreground">
            <p>
              Tunai:{" "}
              <span className="font-display font-bold tabular-nums text-foreground">
                {formatRupiah(cashAmount)}
              </span>
            </p>
            <p>
              QRIS:{" "}
              <span className="font-display font-bold tabular-nums text-primary">
                {formatRupiah(qrisAmount)}
              </span>
            </p>
          </div>
        )}
        {method === "PENDING" && (
          <p className="rounded-full bg-warning-soft px-3 py-1 text-[12px] font-bold text-warning">
            Belum cair — menunggu pencairan
          </p>
        )}
        <div className="mt-4 flex w-full max-w-xs flex-col gap-2">
          <Button
            size="lg"
            className="h-14 w-full rounded-2xl font-bold"
            onClick={sessionFinalized && onHome ? onHome : onDone}
          >
            Selesai
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full font-bold"
            onClick={() => setShowReceipt(true)}
          >
            Lihat Struk
          </Button>
        </div>
        <p className="mt-1 text-center text-[11.5px] font-semibold text-muted-foreground">
          Tersimpan di perangkat — terkirim otomatis saat online.
        </p>
        {showReceipt && (
          <ReceiptPreview
            sessionId={sessionId}
            mode="receipt"
            cashierName={staffName}
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

          <div className="w-full max-w-xs rounded-2xl bg-primary-soft px-4 py-4 text-center">
            {method === "SPLIT" && (
              <p className="mb-1 text-[11.5px] font-semibold text-muted-foreground">
                Tunai: {formatRupiah(cashAmount)}
              </p>
            )}
            <p className="font-display text-[30px] font-extrabold leading-none tabular-nums text-primary">
              {formatRupiah(qrisPayAmount)}
            </p>
            <p className="mt-2 text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
              {method === "SPLIT" ? "Sisa via QRIS" : "Total pembayaran"}
            </p>
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
        <div className="rounded-2xl bg-primary-soft px-4 py-5 text-center">
          <p className="font-display text-[38px] font-extrabold leading-none tabular-nums text-primary">
            {formatRupiah(total)}
          </p>
          <p className="mt-2 text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
            Total
          </p>
        </div>

        {/* Breakdown */}
        <div className="space-y-1.5 rounded-2xl border border-border bg-card p-3.5 text-[13px] font-semibold [&_.tabular-nums]:font-display">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal ({activeItems.length} item)</span>
            <span className="tabular-nums">{formatRupiah(subtotal)}</span>
          </div>
          {taxAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Pajak{taxMode === "pct" ? ` (${taxCharge.value}%)` : ""}
              </span>
              <span className="tabular-nums">+{formatRupiah(taxAmount)}</span>
            </div>
          )}
          {serviceAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Service{serviceMode === "pct" ? ` (${serviceCharge.value}%)` : ""}
              </span>
              <span className="tabular-nums">+{formatRupiah(serviceAmount)}</span>
            </div>
          )}
          {discountAmount > 0 && (
            <div className="flex justify-between text-primary">
              <span>
                Diskon{discountMode === "pct" ? ` (${discountCharge.value}%)` : ""}
              </span>
              <span className="tabular-nums">-{formatRupiah(discountAmount)}</span>
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
          <div className={cn("grid gap-2", paymentMethods.length > 3 ? "grid-cols-4" : "grid-cols-3")}>
            {paymentMethods.map((pm) => (
              <Button
                key={pm.value}
                variant="outline"
                onClick={() => {
                  setMethod(pm.value);
                  setCashInput("");
                  setQrisStep("idle");
                }}
                className={cn(
                  "h-12 rounded-xl text-[12.5px] font-bold",
                  method === pm.value
                    ? pm.value === "PENDING"
                      ? "border-warning bg-warning-soft text-warning"
                      : "border-primary bg-primary-soft text-primary"
                    : "bg-card-2 text-muted-foreground"
                )}
              >
                {pm.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Split: cash portion + QRIS remainder */}
        {method === "SPLIT" && (
          <div className="space-y-3">
            <Label className="text-xs">Bagian Tunai</Label>
            <div className="grid grid-cols-3 gap-2">
              {quickAmounts.slice(0, 6).filter((qa) => qa.value < total).map((qa) => (
                <Button
                  key={qa.value}
                  variant="outline"
                  onClick={() => { setCashInput(qa.value.toString()); setShowKeypad(false); }}
                  className={cn(
                    "font-display h-12 rounded-xl text-[13px] font-bold tabular-nums",
                    cashAmount === qa.value
                      ? "border-primary bg-primary-soft text-primary"
                      : "bg-card-2 text-muted-foreground"
                  )}
                >
                  {qa.label}
                </Button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowKeypad(!showKeypad)}
              className="w-full text-xs text-muted-foreground"
            >
              Jumlah lain
              <ChevronDown className={cn("size-3 transition-transform", showKeypad && "rotate-180")} />
            </Button>
            {showKeypad && (
              <div className="space-y-2">
                <div className="font-display rounded-2xl border border-border bg-card px-3 py-3 text-center text-[24px] font-bold tabular-nums">
                  {formatRupiah(parseInt(cashInput) || 0)}
                </div>
                <NumericKeypad value={cashInput} onChange={setCashInput} />
              </div>
            )}
            {cashAmount > 0 && cashAmount < total && (
              <div className="space-y-1.5 rounded-2xl bg-primary-soft p-3.5 text-[13px] font-semibold">
                <div className="flex justify-between">
                  <span>Tunai</span>
                  <span className="font-display font-bold tabular-nums">{formatRupiah(cashAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>QRIS</span>
                  <span className="font-display font-bold tabular-nums text-primary">
                    {formatRupiah(qrisAmount)}
                  </span>
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
                <Button
                  key={qa.value}
                  variant="outline"
                  onClick={() => {
                    setCashInput(qa.value.toString());
                    setShowKeypad(false);
                  }}
                  className={cn(
                    "font-display h-12 rounded-xl text-[13px] font-bold tabular-nums",
                    cashAmount === qa.value
                      ? "border-primary bg-primary-soft text-primary"
                      : "bg-card-2 text-muted-foreground"
                  )}
                >
                  {qa.label}
                </Button>
              ))}
            </div>

            {cashAmount > 0 && (
              <div className="space-y-1.5 rounded-2xl bg-primary-soft p-3.5 text-[13px] font-semibold">
                <div className="flex justify-between">
                  <span>Dibayar</span>
                  <span className="font-display font-bold tabular-nums">{formatRupiah(cashAmount)}</span>
                </div>
                {cashAmount >= total && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11.5px] font-extrabold uppercase tracking-wide text-muted-foreground">
                      Kembalian
                    </span>
                    <span className="font-display text-[22px] font-bold tabular-nums text-primary">
                      {formatRupiah(change)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowKeypad(!showKeypad)}
              className="w-full text-xs text-muted-foreground"
            >
              Jumlah lain
              <ChevronDown className={cn("size-3 transition-transform", showKeypad && "rotate-180")} />
            </Button>

            {showKeypad && (
              <div className="space-y-2">
                <div className="font-display rounded-2xl border border-border bg-card px-3 py-3 text-center text-[24px] font-bold tabular-nums">
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

        {/* PENDING: read-only total confirmation */}
        {method === "PENDING" && (
          <div className="space-y-1 rounded-2xl border border-warning/30 bg-warning-soft p-3.5">
            <p className="text-[12.5px] font-extrabold text-warning">Pesanan online — belum cair</p>
            <p className="text-[12.5px] font-semibold text-muted-foreground">
              Transaksi dicatat sekarang dan menunggu pencairan dari platform.
            </p>
          </div>
        )}

        <ErrorBanner error={error} />
      </div>

      <BottomBar>
        <Button
          size="lg"
          className="font-display h-14 w-full rounded-2xl text-[15px] font-bold tabular-nums"
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
        <Button
          variant="secondary"
          size="sm"
          onClick={onToggleMode}
          className="h-5 px-2 text-[10px]"
        >
          {mode === "pct" ? "%" : "Rp"}
        </Button>
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
