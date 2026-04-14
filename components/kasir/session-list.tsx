"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ServiceEnum, type TableSession } from "@/lib/db";
import {
  useOpenSessions,
  usePaidSessions,
  useTransaction,
  useUnsyncedCount,
  createSession,
  eraseSession,
  retryUnsyncedTransactions,
} from "@/hooks/use-session-store";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { getServiceLabel, getServiceColor } from "@/lib/kasir-utils";
import { KasirTopBar, Badge, SyncBadge, EmptyState } from "./ui";
import { ErrorBanner } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Plus, ShoppingBag, History, RefreshCw, Receipt, Home, Landmark, Trash2 } from "lucide-react";
import { ReceiptPreview } from "./receipt-preview";
import type { StoreInfo } from "@/lib/settings";
import Link from "next/link";

const serviceOptions: { value: ServiceEnum | ""; label: string }[] = [
  { value: "", label: "Dine In" },
  { value: "GoFood", label: "GoFood" },
  { value: "ShopeeFood", label: "ShopeeFood" },
  { value: "GrabFood", label: "GrabFood" },
  { value: "Take_Away", label: "Bawa Pulang" },
];

export function SessionList({
  staffId,
  staffName,
  storeInfo,
  onOpenSession,
  onOpenPaidSession,
}: {
  staffId: string;
  staffName: string;
  storeInfo: StoreInfo;
  onOpenSession: (sessionId: string) => void;
  onOpenPaidSession: (sessionId: string) => void;
}) {
  const sessions = useOpenSessions();
  const paidSessions = usePaidSessions();
  const unsyncedCount = useUnsyncedCount();

  const [tab, setTab] = useState<"active" | "history">("active");
  const [showForm, setShowForm] = useState(false);
  const [service, setService] = useState<ServiceEnum | "">("");
  const [customerAlias, setCustomerAlias] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [receiptSessionId, setReceiptSessionId] = useState<string | null>(null);

  // Query ALL sessions created today (open, paid, erased) for unique table numbering
  const todaySessions = useLiveQuery(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    return db.table_sessions
      .filter((s) => {
        const created = new Date(s.createdAt);
        return created >= startOfDay && created < endOfDay;
      })
      .toArray();
  }, []);

  const getNextTableNumber = () => {
    const tableNumbers = (todaySessions ?? [])
      .map((s) => s.name.match(/^Table (\d+)$/))
      .filter(Boolean)
      .map((m) => parseInt(m![1]));
    return tableNumbers.length > 0 ? Math.max(...tableNumbers) + 1 : 1;
  };

  const handleCreate = async () => {
    setError(null);
    const id = await createSession({
      name: `Meja ${getNextTableNumber()}`,
      service: service || null,
      customerAlias: customerAlias.trim() || null,
      customerPhone: customerPhone.trim() || null,
      ownerId: staffId,
    });
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
              <Button size="sm" onClick={() => setShowForm(!showForm)}>
                <Plus data-icon="inline-start" className="size-4" />
                Buat Sesi
              </Button>
            </div>

            {/* Create form */}
            {showForm && (
              <div className="rounded-lg border bg-card p-3 space-y-2">
                <div className="rounded-lg bg-primary/5 px-3 py-2 text-sm font-medium text-center">
                  Table {getNextTableNumber()}
                </div>
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
                      if (window.confirm("Batalkan sesi ini?")) {
                        await eraseSession(session.id);
                      }
                    }}
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
          storeInfo={storeInfo}
          onClose={() => setReceiptSessionId(null)}
        />
      )}
    </>
  );
}

function SessionCard({
  session,
  onClick,
  onErase,
}: {
  session: { id: string; name: string; service: ServiceEnum | null; customerAlias: string | null; customerPhone: string | null; createdAt: string };
  onClick: () => void;
  onErase: () => void;
}) {
  const itemCount = useLiveQuery(
    () => db.order_items.where("tableSessionId").equals(session.id).count(),
    [session.id]
  );

  return (
    <div className="rounded-lg border bg-card p-3 min-h-14">
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left active:bg-accent transition-colors"
      >
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">{session.name}</span>
          <div className="flex items-center gap-1.5">
            {typeof itemCount === "number" && itemCount > 0 && (
              <Badge className="bg-primary/10 text-primary">{itemCount} item</Badge>
            )}
            <Badge className={getServiceColor(session.service)}>
              {getServiceLabel(session.service)}
            </Badge>
          </div>
        </div>
        {(session.customerAlias || session.customerPhone || session.createdAt) && (
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {session.customerAlias && <span>{session.customerAlias}</span>}
            {session.customerPhone && <span>{session.customerPhone}</span>}
            <span>{formatDateTime(session.createdAt, "short")}</span>
          </div>
        )}
      </button>
      <div className="mt-2 flex justify-end">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onErase();
          }}
        >
          <Trash2 className="size-3 mr-1" />
          Batalkan
        </Button>
      </div>
    </div>
  );
}

function PaidSessionCard({
  session,
  onClick,
  onReceipt,
}: {
  session: TableSession;
  onClick: () => void;
  onReceipt: () => void;
}) {
  const tx = useTransaction(session.id);
  const isErased = !!session.erasedAt && !session.paidAt;

  return (
    <div className="rounded-lg border bg-card p-3 min-h-14">
      <button
        type="button"
        onClick={isErased ? undefined : onClick}
        className={cn("w-full text-left", isErased && "cursor-default")}
        disabled={isErased}
      >
        <div className="flex items-center justify-between">
          <span className={cn("font-medium text-sm", isErased && "text-muted-foreground")}>{session.name}</span>
          <div className="flex items-center gap-1.5">
            <SyncBadge synced={session.synced} />
            {isErased ? (
              <Badge className="bg-destructive/10 text-destructive">Dibatalkan</Badge>
            ) : tx ? (
              <Badge className="bg-primary/10 text-primary">
                {formatRupiah(tx.totalAmount)}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {session.customerAlias && <span>{session.customerAlias}</span>}
          {session.customerPhone && <span>{session.customerPhone}</span>}
          {!isErased && tx && <span>{tx.paymentMethod === "CASH" ? "Tunai" : "QRIS"}</span>}
          {isErased && session.erasedAt && <span>{formatDateTime(session.erasedAt, "short")}</span>}
          {!isErased && session.paidAt && <span>{formatDateTime(session.paidAt, "short")}</span>}
        </div>
      </button>
      {!isErased && (
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onReceipt();
            }}
          >
            <Receipt className="size-3 mr-1" />
            Struk
          </Button>
        </div>
      )}
    </div>
  );
}
