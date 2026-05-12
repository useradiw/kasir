"use client";

import { useState } from "react";
import { type ServiceEnum } from "@/lib/db";
import {
  useOpenSessions,
  usePaidSessions,
  useUnsyncedCount,
  createSession,
  eraseSession,
  renameSession,
  updateSessionService,
  retryUnsyncedTransactions,
} from "@/hooks/use-session-store";
import { KasirTopBar, EmptyState } from "./ui";
import { ErrorBanner } from "@/components/shared/ui";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Plus, ShoppingBag, History, RefreshCw, Home, Landmark } from "lucide-react";
import { ReceiptPreview } from "./receipt-preview";
import { useKasir } from "./kasir-context";
import { SessionCard } from "./session-card";
import { PaidSessionCard, SplitReceiptPicker } from "./paid-session-card";
import Link from "next/link";

const serviceOptions: { value: ServiceEnum | ""; label: string }[] = [
  { value: "", label: "Dine In" },
  { value: "GoFood", label: "GoFood" },
  { value: "ShopeeFood", label: "ShopeeFood" },
  { value: "GrabFood", label: "GrabFood" },
  { value: "Take_Away", label: "Bawa Pulang" },
];

export function SessionList({
  onOpenSession,
  onOpenPaidSession,
}: {
  onOpenSession: (sessionId: string) => void;
  onOpenPaidSession: (sessionId: string) => void;
}) {
  const { staffId, staffName, storeInfo } = useKasir();
  const sessions = useOpenSessions();
  const paidSessions = usePaidSessions();
  const unsyncedCount = useUnsyncedCount();

  const [tab, setTab] = useState<"active" | "history">("active");
  const [showForm, setShowForm] = useState(false);
  const [tableName, setTableName] = useState("");
  const [service, setService] = useState<ServiceEnum | "">("");
  const [customerAlias, setCustomerAlias] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [receiptSessionId, setReceiptSessionId] = useState<string | null>(null);
  const [receiptSplitGroup, setReceiptSplitGroup] = useState<number | undefined>(undefined);
  const [receiptSplitTotal, setReceiptSplitTotal] = useState<number | undefined>(undefined);
  const [pickerSessionId, setPickerSessionId] = useState<string | null>(null);
  const confirm = useConfirm();

  const handleCreate = async () => {
    setError(null);
    const name = tableName.trim() || "Meja 1";
    const id = await createSession({
      name,
      service: service || null,
      customerAlias: customerAlias.trim() || null,
      customerPhone: customerPhone.trim() || null,
      ownerId: staffId,
    });
    setTableName("");
    setService("");
    setCustomerAlias("");
    setCustomerPhone("");
    setShowForm(false);
    onOpenSession(id);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await retryUnsyncedTransactions();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <KasirTopBar title="Kasir">
        <span className="text-xs text-muted-foreground truncate max-w-24">{staffName}</span>
        <Link href="/cashregister" className="p-1">
          <Landmark className="size-5 text-muted-foreground" />
        </Link>
        <Link href="/" className="p-1">
          <Home className="size-5 text-muted-foreground" />
        </Link>
      </KasirTopBar>

      {/* Tabs */}
      <div className="flex border-b px-3">
        <button
          type="button"
          onClick={() => setTab("active")}
          className={cn(
            "flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors",
            tab === "active"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
          )}
        >
          Aktif
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={cn(
            "flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors",
            tab === "history"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
          )}
        >
          Riwayat
        </button>
      </div>

      {/* Sync banner */}
      {typeof unsyncedCount === "number" && unsyncedCount > 0 && (
        <div className="flex items-center justify-between bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 border-b">
          <span className="text-xs text-yellow-700 dark:text-yellow-300">
            {unsyncedCount} transaksi belum disinkronkan
          </span>
          <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing} className="h-7 text-xs">
            <RefreshCw className={cn("size-3 mr-1", syncing && "animate-spin")} />
            Sync
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {tab === "active" ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Sesi Aktif</h2>
              <Button size="sm" onClick={() => { setTableName("Meja 1"); setShowForm((v) => !v); }}>
                <Plus data-icon="inline-start" className="size-4" />
                Buat Sesi
              </Button>
            </div>

            {/* Create form */}
            {showForm && (
              <div className="rounded-lg border bg-card p-3 space-y-2">
                <Input
                  placeholder="Meja 1"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  className="text-center font-medium"
                />
                <select
                  value={service}
                  onChange={(e) => setService(e.target.value as ServiceEnum | "")}
                  className="w-full h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm"
                >
                  {serviceOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Nama pelanggan (opsional)"
                  value={customerAlias}
                  onChange={(e) => setCustomerAlias(e.target.value)}
                />
                <Input
                  type="tel"
                  placeholder="No. HP pelanggan (opsional)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
                <ErrorBanner error={error} />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={handleCreate}>
                    Buat
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
                    Batal
                  </Button>
                </div>
              </div>
            )}

            {/* Session list */}
            {!sessions || sessions.length === 0 ? (
              <EmptyState message="Belum ada sesi aktif" icon={ShoppingBag} />
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onClick={() => onOpenSession(session.id)}
                    onErase={async () => {
                      const ok = await confirm({
                        title: "Batalkan sesi ini?",
                        description: "Sesi akan ditandai dibatalkan dan tidak dapat dikembalikan.",
                        destructive: true,
                        confirmLabel: "Batalkan sesi",
                      });
                      if (ok) await eraseSession(session.id);
                    }}
                    onRename={(name) => renameSession(session.id, name)}
                    onServiceChange={(service) => updateSessionService(session.id, service)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <h2 className="font-semibold">Riwayat</h2>
            {!paidSessions || paidSessions.length === 0 ? (
              <EmptyState message="Belum ada riwayat" icon={History} />
            ) : (
              <div className="space-y-2">
                {paidSessions.map((session) => (
                  <PaidSessionCard
                    key={session.id}
                    session={session}
                    onClick={() => onOpenPaidSession(session.id)}
                    onReceipt={() => setReceiptSessionId(session.id)}
                    onSplitReceipt={(group, total) => {
                      setReceiptSessionId(session.id);
                      setReceiptSplitGroup(group);
                      setReceiptSplitTotal(total);
                    }}
                    onShowPicker={() => setPickerSessionId(session.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {receiptSessionId && (
        <ReceiptPreview
          sessionId={receiptSessionId}
          mode="receipt"
          cashierName={staffName}
          splitGroup={receiptSplitGroup}
          splitTotalGroups={receiptSplitTotal}
          onClose={() => { setReceiptSessionId(null); setReceiptSplitGroup(undefined); setReceiptSplitTotal(undefined); }}
        />
      )}
      {pickerSessionId && (
        <SplitReceiptPicker
          sessionId={pickerSessionId}
          onSelect={(group, total) => {
            setPickerSessionId(null);
            setReceiptSessionId(pickerSessionId);
            setReceiptSplitGroup(group);
            setReceiptSplitTotal(total);
          }}
          onUnified={() => {
            setPickerSessionId(null);
            setReceiptSessionId(pickerSessionId);
            setReceiptSplitGroup(undefined);
            setReceiptSplitTotal(undefined);
          }}
          onClose={() => setPickerSessionId(null)}
        />
      )}
    </>
  );
}
