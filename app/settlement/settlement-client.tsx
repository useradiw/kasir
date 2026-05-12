"use client";

import { useState } from "react";
import type { SettlementData } from "@/app/actions/admin/queries";
import type { RoleEnum } from "@/generated/prisma";
import { createSettlement, deleteSettlement } from "@/app/actions/settlement";
import { useAdminAction } from "@/hooks/use-admin-action";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { getServiceLabel, getServiceColor } from "@/lib/kasir-utils";
import type { ServiceEnum } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBanner, PageHeader } from "@/components/shared/ui";
import { Badge } from "@/components/shared/badge";
import { cn } from "@/lib/utils";
import { Plus, Trash2, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import Link from "next/link";

type ServiceKey = "GoFood" | "ShopeeFood" | "GrabFood";

const serviceFilterOptions: { value: ServiceKey | "all"; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "GoFood", label: "GoFood" },
  { value: "ShopeeFood", label: "ShopeeFood" },
  { value: "GrabFood", label: "GrabFood" },
];

function getCommissionForService(
  service: string,
  settings: SettlementData["commissionSettings"],
) {
  if (service === "GoFood") return settings.gofood;
  if (service === "ShopeeFood") return settings.shopeefood;
  if (service === "GrabFood") return settings.grabfood;
  return { pct: 0, flat: 0 };
}

export function SettlementClient({
  data,
  staffRole,
}: {
  data: SettlementData;
  staffRole: RoleEnum;
}) {
  const [tab, setTab] = useState<"create" | "history">("create");
  const [serviceFilter, setServiceFilter] = useState<ServiceKey | "all">("all");

  const canDelete = staffRole === "OWNER" || staffRole === "MANAGER";

  const filteredUnsettled = serviceFilter === "all"
    ? data.unsettled
    : data.unsettled.filter((t) => t.service === serviceFilter);

  const filteredSettlements = serviceFilter === "all"
    ? data.settlements
    : data.settlements.filter((s) => s.service === serviceFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/" className="p-1">
          <ArrowLeft className="size-5 text-muted-foreground" />
        </Link>
        <PageHeader title="Pencairan Online" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="p-3">
            <p className="text-xs text-muted-foreground">Belum Cair</p>
            <CardTitle className="text-lg text-amber-600 dark:text-amber-400">
              {formatRupiah(data.summary.unsettledAmount)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{data.summary.unsettledCount} transaksi</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3">
            <p className="text-xs text-muted-foreground">Sudah Cair</p>
            <CardTitle className="text-lg text-primary">
              {formatRupiah(data.summary.settledAmount)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{data.summary.settledCount} transaksi</p>
          </CardHeader>
        </Card>
      </div>

      {/* Service filter */}
      <select
        value={serviceFilter}
        onChange={(e) => setServiceFilter(e.target.value as ServiceKey | "all")}
        className="w-full h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm"
      >
        {serviceFilterOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          type="button"
          onClick={() => setTab("create")}
          className={cn(
            "flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors",
            tab === "create" ? "border-primary text-primary" : "border-transparent text-muted-foreground",
          )}
        >
          Buat Pencairan
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={cn(
            "flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors",
            tab === "history" ? "border-primary text-primary" : "border-transparent text-muted-foreground",
          )}
        >
          Riwayat
        </button>
      </div>

      {tab === "create" ? (
        <CreateSettlementTab
          unsettled={filteredUnsettled}
          commissionSettings={data.commissionSettings}
        />
      ) : (
        <SettlementHistoryTab
          settlements={filteredSettlements}
          canDelete={canDelete}
        />
      )}
    </div>
  );
}

// ─── Create Settlement Tab ──────────────────────────────────────────────────

function CreateSettlementTab({
  unsettled,
  commissionSettings,
}: {
  unsettled: SettlementData["unsettled"];
  commissionSettings: SettlementData["commissionSettings"];
}) {
  const { isPending, run, error } = useAdminAction();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [commissionInput, setCommissionInput] = useState("");
  const [deductions, setDeductions] = useState<{ label: string; amount: string }[]>([]);
  const [finalAmountInput, setFinalAmountInput] = useState("");
  const [notes, setNotes] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const selectedTx = unsettled.filter((t) => selectedIds.has(t.id));
  const totalGross = selectedTx.reduce((s, t) => s + t.totalAmount, 0);

  const detectedService = selectedTx.length > 0 ? selectedTx[0].service as ServiceKey : null;
  const mixedServices = selectedTx.some((t) => t.service !== detectedService);

  const commission = getCommissionForService(detectedService ?? "", commissionSettings);
  const autoCommission = selectedTx.length > 0
    ? Math.round(totalGross * commission.pct / 100) + commission.flat * selectedTx.length
    : 0;

  const commissionAmount = parseInt(commissionInput) || autoCommission;
  const totalDeductions = deductions.reduce((s, d) => s + (parseInt(d.amount) || 0), 0);
  const autoFinal = totalGross - commissionAmount - totalDeductions;
  const finalAmount = finalAmountInput !== "" ? (parseInt(finalAmountInput) || 0) : autoFinal;

  const toggleTx = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setCommissionInput("");
    setFinalAmountInput("");
  };

  const handleSubmit = () => {
    if (!detectedService || mixedServices || selectedIds.size === 0) return;
    run(
      () => createSettlement({
        service: detectedService,
        transactionIds: [...selectedIds],
        commissionAmount,
        deductions: deductions
          .filter((d) => d.label.trim() && parseInt(d.amount) > 0)
          .map((d) => ({ label: d.label.trim(), amount: parseInt(d.amount) })),
        finalAmount,
        notes: notes.trim() || undefined,
      }),
      {
        successMessage: "Pencairan berhasil disimpan",
        onSuccess: () => {
          setSelectedIds(new Set());
          setCommissionInput("");
          setDeductions([]);
          setFinalAmountInput("");
          setNotes("");
        },
      },
    );
  };

  if (unsettled.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Tidak ada transaksi yang belum dicairkan.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Transaction dropdown */}
      <div className="space-y-2">
        <Label className="text-xs">Pilih Transaksi</Label>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full flex items-center justify-between h-9 rounded-lg border border-input bg-card px-3 text-sm"
        >
          <span className="text-muted-foreground">
            {selectedIds.size > 0 ? `${selectedIds.size} transaksi dipilih` : "Pilih transaksi..."}
          </span>
          {dropdownOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>

        {dropdownOpen && (
          <div className="rounded-lg border bg-card max-h-60 overflow-y-auto">
            {unsettled.map((tx) => (
              <label
                key={tx.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-accent cursor-pointer border-b last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(tx.id)}
                  onChange={() => toggleTx(tx.id)}
                  className="accent-primary"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Badge className={cn(getServiceColor(tx.service as ServiceEnum), "text-[10px]")}>
                      {getServiceLabel(tx.service as ServiceEnum)}
                    </Badge>
                    <span className="text-xs truncate">{tx.externalOrderId ?? tx.sessionName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{formatDateTime(tx.paidAt)}</span>
                    <span className="font-medium">{formatRupiah(tx.totalAmount)}</span>
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Selected summary */}
      {selectedIds.size > 0 && (
        <div className="space-y-4">
          {mixedServices && (
            <ErrorBanner error="Pilih transaksi dari satu platform saja." />
          )}

          {/* Gross total */}
          <div className="rounded-lg border bg-card p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Penjualan Kotor ({selectedIds.size} transaksi)</span>
              <span className="font-bold">{formatRupiah(totalGross)}</span>
            </div>
          </div>

          {/* Commission */}
          <div className="space-y-1">
            <Label className="text-xs">
              Komisi Platform
              {commission.pct > 0 && (
                <span className="text-muted-foreground ml-1">
                  (setting: {commission.pct}%{commission.flat > 0 ? ` + ${formatRupiah(commission.flat)}/tx` : ""})
                </span>
              )}
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              placeholder={autoCommission.toString()}
              value={commissionInput}
              onChange={(e) => setCommissionInput(e.target.value)}
              className="h-9"
            />
            {!commissionInput && autoCommission > 0 && (
              <p className="text-[10px] text-muted-foreground">Auto: {formatRupiah(autoCommission)}</p>
            )}
          </div>

          {/* Dynamic deductions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Potongan Lain</Label>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setDeductions([...deductions, { label: "", amount: "" }])}
              >
                <Plus className="size-3 mr-1" /> Tambah
              </Button>
            </div>
            {deductions.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  placeholder="Label (cth: Biaya Marketing)"
                  value={d.label}
                  onChange={(e) => {
                    const next = [...deductions];
                    next[i] = { ...next[i], label: e.target.value };
                    setDeductions(next);
                  }}
                  className="h-8 text-xs flex-1"
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Jumlah"
                  value={d.amount}
                  onChange={(e) => {
                    const next = [...deductions];
                    next[i] = { ...next[i], amount: e.target.value };
                    setDeductions(next);
                  }}
                  className="h-8 text-xs w-28"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-destructive"
                  onClick={() => setDeductions(deductions.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
          </div>

          {/* Breakdown */}
          <div className="rounded-lg border bg-card p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Penjualan Kotor</span>
              <span>{formatRupiah(totalGross)}</span>
            </div>
            <div className="flex justify-between text-destructive">
              <span>Komisi</span>
              <span>-{formatRupiah(commissionAmount)}</span>
            </div>
            {deductions.map((d, i) => {
              const amt = parseInt(d.amount) || 0;
              if (amt <= 0) return null;
              return (
                <div key={i} className="flex justify-between text-destructive">
                  <span>{d.label || "Potongan"}</span>
                  <span>-{formatRupiah(amt)}</span>
                </div>
              );
            })}
            <div className="border-t pt-1 flex justify-between font-bold">
              <span>Pencairan Bersih</span>
              <span className="text-primary">{formatRupiah(autoFinal)}</span>
            </div>
          </div>

          {/* Final amount override */}
          <div className="space-y-1">
            <Label className="text-xs">
              Jumlah Diterima (aktual)
              <span className="text-muted-foreground ml-1">— kosongkan jika sesuai hitungan</span>
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              placeholder={autoFinal.toString()}
              value={finalAmountInput}
              onChange={(e) => setFinalAmountInput(e.target.value)}
              className="h-9"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-xs">Catatan (opsional)</Label>
            <Input
              placeholder="Catatan pencairan..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-9"
            />
          </div>

          <ErrorBanner error={error} />

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={isPending || mixedServices || selectedIds.size === 0}
          >
            {isPending ? "Menyimpan..." : "Simpan Pencairan"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Settlement History Tab ─────────────────────────────────────────────────

function SettlementHistoryTab({
  settlements,
  canDelete,
}: {
  settlements: SettlementData["settlements"];
  canDelete: boolean;
}) {
  if (settlements.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Belum ada riwayat pencairan.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {settlements.map((s) => (
        <SettlementCard key={s.id} settlement={s} canDelete={canDelete} />
      ))}
    </div>
  );
}

function SettlementCard({
  settlement,
  canDelete,
}: {
  settlement: SettlementData["settlements"][number];
  canDelete: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { isPending, run } = useAdminAction();
  const confirm = useConfirm();

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Batalkan pencairan?",
      description: `${settlement.items.length} transaksi akan kembali ke status belum cair.`,
      destructive: true,
      confirmLabel: "Batalkan Pencairan",
    });
    if (ok) {
      run(() => deleteSettlement(settlement.id), {
        successMessage: "Pencairan dibatalkan",
      });
    }
  };

  const totalDeductions = settlement.deductions.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        className="w-full p-3 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={getServiceColor(settlement.service as ServiceEnum)}>
              {getServiceLabel(settlement.service as ServiceEnum)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {settlement.items.length} transaksi
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-primary">{formatRupiah(settlement.finalAmount)}</span>
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
          <span>{formatDateTime(settlement.settlementDate)}</span>
          <span>oleh {settlement.settledBy}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t px-3 pb-3 pt-2 space-y-2">
          {/* Breakdown */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Penjualan Kotor</span>
              <span>{formatRupiah(settlement.totalGross)}</span>
            </div>
            <div className="flex justify-between text-destructive">
              <span>Komisi</span>
              <span>-{formatRupiah(settlement.commissionAmount)}</span>
            </div>
            {settlement.deductions.map((d) => (
              <div key={d.id} className="flex justify-between text-destructive">
                <span>{d.label}</span>
                <span>-{formatRupiah(d.amount)}</span>
              </div>
            ))}
            {totalDeductions > 0 && (
              <div className="flex justify-between text-destructive">
                <span>Total Potongan</span>
                <span>-{formatRupiah(settlement.commissionAmount + totalDeductions)}</span>
              </div>
            )}
            <div className="border-t pt-1 flex justify-between font-medium">
              <span>Diterima</span>
              <span className="text-primary">{formatRupiah(settlement.finalAmount)}</span>
            </div>
          </div>

          {/* Transactions */}
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground">Transaksi:</p>
            {settlement.items.map((item) => (
              <div key={item.transactionId} className="flex items-center justify-between text-xs">
                <span className="truncate">
                  {item.externalOrderId ?? item.sessionName}
                </span>
                <span className="text-muted-foreground shrink-0 ml-2">{formatRupiah(item.totalAmount)}</span>
              </div>
            ))}
          </div>

          {settlement.notes && (
            <p className="text-xs text-muted-foreground italic">{settlement.notes}</p>
          )}

          {canDelete && (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              <Trash2 className="size-3 mr-1" />
              Batalkan Pencairan
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
