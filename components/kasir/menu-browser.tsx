"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type MenuItem, type MenuVariant } from "@/lib/db";
import { addOrderItem, useOrderItems } from "@/hooks/use-session-store";
import { formatRupiah } from "@/lib/format";
import { calcItemPrice, calcSubtotal } from "@/lib/kasir-utils";
import { KasirTopBar, BottomBar, QtyControl, EmptyState, Badge } from "./ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

const PAKET_TAB_ID = "__paket__";

export function MenuBrowser({
  sessionId,
  onBack,
  onReview,
  onHome,
}: {
  sessionId: string;
  onBack: () => void;
  onReview: () => void;
  onHome?: () => void;
}) {
  const categories = useLiveQuery(() => db.categories.orderBy("sortOrder").toArray());
  const packages = useLiveQuery(() => db.packages.toArray());
  const orderItems = useOrderItems(sessionId);

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Default to first category when loaded
  const effectiveCategoryId = activeCategoryId ?? categories?.[0]?.id ?? null;
  const showingPackages = activeCategoryId === PAKET_TAB_ID;

  const activeItems = orderItems
    ? orderItems.filter((i) => i.status !== "CANCELLED")
    : [];
  const activeItemCount = activeItems.length;
  const subtotal = calcSubtotal(orderItems ?? []);

  return (
    <>
      <KasirTopBar title="Menu" onBack={onBack} onHome={onHome} />

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto px-3 py-2 border-b scrollbar-hide">
        {categories?.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => {
              setActiveCategoryId(cat.id);
              setExpandedItemId(null);
            }}
            className={cn(
              "shrink-0 rounded-full px-3 h-8 text-xs font-medium transition-colors",
              effectiveCategoryId === cat.id && !showingPackages
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {cat.name}
          </button>
        ))}
        {packages && packages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setActiveCategoryId(PAKET_TAB_ID);
              setExpandedItemId(null);
            }}
            className={cn(
              "shrink-0 rounded-full px-3 h-8 text-xs font-medium transition-colors",
              showingPackages
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            Paket
          </button>
        )}
      </div>

      {/* Content */}
      <div className={cn("flex-1 overflow-y-auto px-3 py-3", activeItemCount > 0 && "pb-20")}>
        {showingPackages ? (
          <PackageGrid
            sessionId={sessionId}
            expandedItemId={expandedItemId}
            onToggle={setExpandedItemId}
          />
        ) : effectiveCategoryId ? (
          <MenuItemGrid
            sessionId={sessionId}
            categoryId={effectiveCategoryId}
            expandedItemId={expandedItemId}
            onToggle={setExpandedItemId}
          />
        ) : (
          <EmptyState message="Belum ada kategori" />
        )}
      </div>

      {activeItemCount > 0 && (
        <BottomBar>
          <button
            type="button"
            onClick={onReview}
            className="w-full flex items-center justify-between rounded-lg bg-primary px-4 py-3 text-primary-foreground"
          >
            <span className="text-sm font-medium">
              Lihat Pesanan ({activeItemCount} item)
            </span>
            <span className="text-sm font-bold">{formatRupiah(subtotal)}</span>
          </button>
        </BottomBar>
      )}
    </>
  );
}

// ─── Menu Item Grid ──────────────────────────────────────────────────────────

function MenuItemGrid({
  sessionId,
  categoryId,
  expandedItemId,
  onToggle,
}: {
  sessionId: string;
  categoryId: string;
  expandedItemId: string | null;
  onToggle: (id: string | null) => void;
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
}: {
  item: MenuItem;
  sessionId: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const variants = useLiveQuery(
    () => db.menu_variants.where("menuItemId").equals(item.id).toArray(),
    [item.id]
  );

  const [selectedVariant, setSelectedVariant] = useState<MenuVariant | null>(null);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  const handleAdd = async () => {
    const price = calcItemPrice(item, selectedVariant);
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
        <p className="text-xs text-muted-foreground mt-0.5">{formatRupiah(item.price)}</p>
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
              {formatRupiah(calcItemPrice(item, selectedVariant) * qty)}
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

// ─── Package Grid ────────────────────────────────────────────────────────────

function PackageGrid({
  sessionId,
  expandedItemId,
  onToggle,
}: {
  sessionId: string;
  expandedItemId: string | null;
  onToggle: (id: string | null) => void;
}) {
  const packages = useLiveQuery(() => db.packages.toArray());

  if (!packages || packages.length === 0) {
    return <EmptyState message="Belum ada paket" icon={Package} />;
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {packages.map((pkg) => (
        <PackageCard
          key={pkg.id}
          pkg={pkg}
          sessionId={sessionId}
          isExpanded={expandedItemId === pkg.id}
          onToggle={() => onToggle(expandedItemId === pkg.id ? null : pkg.id)}
        />
      ))}
    </div>
  );
}

function PackageCard({
  pkg,
  sessionId,
  isExpanded,
  onToggle,
}: {
  pkg: { id: string; name: string; bundlePrice: number };
  sessionId: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const packageItems = useLiveQuery(
    () => db.package_items.where("packageId").equals(pkg.id).toArray(),
    [pkg.id]
  );
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  const handleAdd = async () => {
    await addOrderItem({
      tableSessionId: sessionId,
      menuItemId: null,
      packageId: pkg.id,
      variantId: null,
      qty,
      note: note.trim() || null,
      nameSnapshot: pkg.name,
      price: pkg.bundlePrice,
    });
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
        <p className="font-medium text-sm leading-tight">{pkg.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{formatRupiah(pkg.bundlePrice)}</p>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t pt-2">
          {/* Package contents */}
          {packageItems && packageItems.length > 0 && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p className="font-medium text-foreground">Isi paket:</p>
              {packageItems.map((pi) => (
                <p key={pi.id}>- {pi.nameSnapshot}</p>
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
              {formatRupiah(pkg.bundlePrice * qty)}
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
