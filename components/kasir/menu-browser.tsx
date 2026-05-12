"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ServiceEnum } from "@/lib/db";
import { useOrderItems } from "@/hooks/use-session-store";
import { formatRupiah } from "@/lib/format";
import { activeItems as getActiveItems, calcSubtotal } from "@/lib/kasir-utils";
import { KasirTopBar, BottomBar, EmptyState } from "./ui";
import { cn } from "@/lib/utils";
import { MenuItemGrid } from "./menu-item-card";
import { PackageGrid } from "./package-card";

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
  const session = useLiveQuery(() => db.table_sessions.get(sessionId), [sessionId]);
  const onlinePrices = useLiveQuery(() => db.online_prices.toArray());
  const orderItems = useOrderItems(sessionId);
  const service = (session?.service ?? null) as ServiceEnum | null;

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Default to first category when loaded
  const effectiveCategoryId = activeCategoryId ?? categories?.[0]?.id ?? null;
  const showingPackages = activeCategoryId === PAKET_TAB_ID;

  const activeItems = getActiveItems(orderItems ?? []);
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
            service={service}
            onlinePrices={onlinePrices ?? []}
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
