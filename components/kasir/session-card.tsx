"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ServiceEnum } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { getServiceLabel, getServiceColor } from "@/lib/kasir-utils";
import { Badge } from "./ui";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Trash2, Pencil, Check, X } from "lucide-react";

const serviceOptions: { value: ServiceEnum | ""; label: string }[] = [
  { value: "", label: "Dine In" },
  { value: "GoFood", label: "GoFood" },
  { value: "ShopeeFood", label: "ShopeeFood" },
  { value: "GrabFood", label: "GrabFood" },
  { value: "Take_Away", label: "Bawa Pulang" },
];

export function SessionCard({
  session,
  onClick,
  onErase,
  onRename,
  onServiceChange,
  onExternalOrderIdChange,
}: {
  session: { id: string; name: string; service: ServiceEnum | null; externalOrderId: string | null; customerAlias: string | null; customerPhone: string | null; createdAt: string };
  onClick: () => void;
  onErase: () => void;
  onRename: (name: string) => Promise<void>;
  onServiceChange: (service: ServiceEnum | null) => Promise<number>;
  onExternalOrderIdChange: (orderId: string) => Promise<void>;
}) {
  const itemCount = useLiveQuery(
    () => db.order_items.where("tableSessionId").equals(session.id).count(),
    [session.id]
  );

  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(session.name);
  const [isEditingService, setIsEditingService] = useState(false);
  const [isEditingOrderId, setIsEditingOrderId] = useState(false);
  const [draftOrderId, setDraftOrderId] = useState(session.externalOrderId ?? "");

  const isOnlineService = session.service === "GoFood" || session.service === "ShopeeFood" || session.service === "GrabFood";

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraftName(session.name);
    setIsEditing(true);
    setIsEditingService(false);
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

  const handleServiceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as ServiceEnum | "";
    try {
      const updated = await onServiceChange(value || null);
      if (updated > 0) {
        notify.success(`${updated} item harga diperbarui`);
      }
    } catch (err) {
      notify.error(err, "Gagal mengubah tipe sesi");
    }
    setIsEditingService(false);
  };

  return (
    <div
      className="rounded-lg border bg-card p-3 min-h-14 cursor-pointer active:bg-accent transition-colors"
      onClick={isEditing || isEditingService ? undefined : onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !isEditing && !isEditingService) onClick();
      }}
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
              onClick={(e) => { e.stopPropagation(); startEdit(e); }}
              className="p-1 text-muted-foreground hover:text-foreground"
              aria-label="Ubah nama meja"
            >
              <Pencil className="size-3" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {typeof itemCount === "number" && itemCount > 0 && (
            <Badge className="bg-primary/10 text-primary">{itemCount} item</Badge>
          )}
          {isEditingService ? (
            <select
              value={session.service ?? ""}
              onChange={handleServiceChange}
              onBlur={() => setIsEditingService(false)}
              autoFocus
              className="h-6 rounded-full border border-input bg-input/30 px-2 text-xs"
            >
              {serviceOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <button
              type="button"
              onClick={() => { setIsEditingService(true); setIsEditing(false); }}
              className="focus:outline-none"
              aria-label="Ubah tipe sesi"
            >
              <Badge className={getServiceColor(session.service)}>
                {getServiceLabel(session.service)}
              </Badge>
            </button>
          )}
        </div>
      </div>
      {isOnlineService && (
        <div className="mt-1 flex items-center gap-1 text-xs" onClick={(e) => e.stopPropagation()}>
          {isEditingOrderId ? (
            <>
              <Input
                value={draftOrderId}
                onChange={(e) => setDraftOrderId(e.target.value)}
                className="h-6 text-xs flex-1"
                placeholder="ID Pesanan"
                autoFocus
              />
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={async (e) => {
                e.stopPropagation();
                try {
                  await onExternalOrderIdChange(draftOrderId);
                  setIsEditingOrderId(false);
                } catch (err) {
                  notify.error(err, "Gagal mengubah ID pesanan");
                }
              }}>
                <Check className="size-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); setIsEditingOrderId(false); }}>
                <X className="size-3" />
              </Button>
            </>
          ) : (
            <>
              <span className="text-muted-foreground">ID: {session.externalOrderId ?? "-"}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setDraftOrderId(session.externalOrderId ?? ""); setIsEditingOrderId(true); }}
                className="p-0.5 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-3" />
              </button>
            </>
          )}
        </div>
      )}
      {(session.customerAlias || session.customerPhone || session.createdAt) && (
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {session.customerAlias && <span>{session.customerAlias}</span>}
          {session.customerPhone && <span>{session.customerPhone}</span>}
          <span>{formatDateTime(session.createdAt, "short")}</span>
        </div>
      )}
      <div className="mt-2 flex justify-end" onClick={(e) => e.stopPropagation()}>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs text-destructive hover:text-destructive"
          onClick={onErase}
        >
          <Trash2 className="size-3 mr-1" />
          Batalkan
        </Button>
      </div>
    </div>
  );
}
