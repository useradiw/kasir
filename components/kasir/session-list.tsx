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
  renameSession,
  retryUnsyncedTransactions,
} from "@/hooks/use-session-store";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { getServiceLabel, getServiceColor } from "@/lib/kasir-utils";
import { KasirTopBar, Badge, SyncBadge, EmptyState } from "./ui";
import { ErrorBanner } from "@/components/shared/ui";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Plus, ShoppingBag, History, RefreshCw, Receipt, Home, Landmark, Trash2, Pencil, Check, X } from "lucide-react";
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
  const [tableName, setTableName] = useState("");
  const [service, setService] = useState<ServiceEnum | "">("");
  const [customerAlias, setCustomerAlias] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [receiptSessionId, setReceiptSessionId] = useState<string | null>(null);
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
  onRename,
}: {
  session: { id: string; name: string; service: ServiceEnum | null; customerAlias: string | null; customerPhone: string | null; createdAt: string };
  onClick: () => void;
  onErase: () => void;
  onRename: (name: string) => Promise<void>;
}) {
  const itemCount = useLiveQuery(
    () => db.order_items.where("tableSessionId").equals(session.id).count(),
    [session.id]
  );

  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(session.name);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraftName(session.name);
    setIsEditing(true);
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
  };

  const saveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await onRename(draftName);
      setIsEditing(false);
    } catch (err) {
      notify.error(err, "Gagal mengubah nama");
    }
  };

  return (
    <div className="rounded-lg border bg-card p-3 min-h-14">
      <button
        type="button"
        onClick={isEditing ? undefined : onClick}
        className="w-full text-left active:bg-accent transition-colors"
      >
        <div className="flex items-center justify-between gap-2">
          {isEditing ? (
            <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="h-7 text-sm"
                autoFocus
              />
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={saveEdit}>
                <Check className="size-4" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={cancelEdit}>
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1 min-w-0">
              <span className="font-medium text-sm truncate">{session.name}</span>
              <button
                type="button"
                onClick={startEdit}
                className="p-1 text-muted-foreground hover:text-foreground"
                aria-label="Ubah nama meja"
              >
                <Pencil className="size-3" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-1.5 shrink-0">
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
