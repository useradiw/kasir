"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type MenuItem, type MenuVariant, type OnlinePrice, type ServiceEnum } from "@/lib/db";
import { addOrderItem } from "@/hooks/use-session-store";
import { formatRupiah } from "@/lib/format";
import { calcItemPrice } from "@/lib/kasir-utils";
import { QtyControl, EmptyState } from "./ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function MenuItemGrid({
  sessionId,
  categoryId,
  expandedItemId,
  onToggle,
  service,
  onlinePrices,
}: {
  sessionId: string;
  categoryId: string;
  expandedItemId: string | null;
  onToggle: (id: string | null) => void;
  service: ServiceEnum | null;
  onlinePrices: OnlinePrice[];
}) {
  const items = useLiveQuery(
    () =>
      db.menu_items
        .where("categoryId")
        .equals(categoryId)
        .filter((i) => !i.isHidden)
        .toArray(),
    [categoryId]
  );

  if (!items || items.length === 0) {
    return <EmptyState message="Belum ada item di kategori ini" />;
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <MenuItemCard
          key={item.id}
          item={item}
          sessionId={sessionId}
          isExpanded={expandedItemId === item.id}
          onToggle={() => onToggle(expandedItemId === item.id ? null : item.id)}
          service={service}
          onlinePrices={onlinePrices}
        />
      ))}
    </div>
  );
}

function MenuItemCard({
  item,
  sessionId,
  isExpanded,
  onToggle,
  service,
  onlinePrices,
}: {
  item: MenuItem;
  sessionId: string;
  isExpanded: boolean;
  onToggle: () => void;
  service: ServiceEnum | null;
  onlinePrices: OnlinePrice[];
}) {
  const variants = useLiveQuery(
    () => db.menu_variants.where("menuItemId").equals(item.id).toArray(),
    [item.id]
  );

  const [selectedVariant, setSelectedVariant] = useState<MenuVariant | null>(null);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  const handleAdd = async () => {
    const price = calcItemPrice(item, selectedVariant, service, onlinePrices);
    const nameParts = [item.name];
    if (selectedVariant) nameParts.push(`(${selectedVariant.label})`);

    await addOrderItem({
      tableSessionId: sessionId,
      menuItemId: item.id,
      packageId: null,
      variantId: selectedVariant?.id ?? null,
      qty,
      note: note.trim() || null,
      nameSnapshot: nameParts.join(" "),
      price,
    });

    // Reset
    setSelectedVariant(null);
    setQty(1);
    setNote("");
    onToggle();
  };

  return (
    <div
      className={cn(
        "rounded-lg border bg-card transition-all",
        isExpanded && "col-span-2"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-3 text-left active:bg-accent transition-colors rounded-lg"
      >
        <p className="font-medium text-sm leading-tight">{item.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{formatRupiah(calcItemPrice(item, null, service, onlinePrices))}</p>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t pt-2">
          {/* Variants */}
          {variants && variants.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedVariant(null)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  !selectedVariant
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                Normal
              </button>
              {variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVariant(v)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    selectedVariant?.id === v.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {v.label} (+{formatRupiah(v.priceModifier)})
                </button>
              ))}
            </div>
          )}

          {/* Qty + Note */}
          <div className="flex items-center gap-2">
            <QtyControl
              qty={qty}
              onDecrease={() => setQty((q) => Math.max(1, q - 1))}
              onIncrease={() => setQty((q) => q + 1)}
            />
            <Input
              placeholder="Catatan..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="flex-1 h-8 text-xs"
            />
          </div>

          {/* Price + Add button */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {formatRupiah(calcItemPrice(item, selectedVariant, service, onlinePrices) * qty)}
            </span>
            <Button size="sm" onClick={handleAdd}>
              Tambah
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
