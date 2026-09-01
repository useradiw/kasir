"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ServiceEnum } from "@/lib/db";
import { useOrderItems } from "@/hooks/use-session-store";
import { formatRupiah } from "@/lib/format";
import { activeItems as getActiveItems, calcSubtotal } from "@/lib/kasir-utils";
import { KasirTopBar, BottomBar, DockSummary, EmptyState } from "./ui";
import { Button } from "@/components/ui/button";
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
  const categoryStripRef = useRef<HTMLDivElement>(null);

  // A mouse wheel produces vertical deltaY; the strip only scrolls
  // horizontally by touch/drag. Translate deltaY into scrollLeft so a wheel
  // over the strip pans it, but only when it actually overflows — otherwise
  // let the wheel event fall through to page scroll as normal. onWheel is
  // passive in React and cannot preventDefault, so this needs a real
  // addEventListener with { passive: false }.
  useEffect(() => {
    const el = categoryStripRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Default to first category when loaded
  const effectiveCategoryId = activeCategoryId ?? categories?.[0]?.id ?? null;
  const showingPackages = activeCategoryId === PAKET_TAB_ID;

  const activeItems = getActiveItems(orderItems ?? []);
  const activeItemCount = activeItems.length;
  const subtotal = calcSubtotal(orderItems ?? []);

  return (
    <>
      <KasirTopBar title="Menu" sub={session?.name} onBack={onBack} onHome={onHome} />

      {/* Category tabs */}
      <div
        ref={categoryStripRef}
        className="flex gap-2 overflow-x-auto border-b border-border px-3 py-2.5 scrollbar-hide"
      >
        {categories?.map((cat) => (
          <Button
            key={cat.id}
            variant={effectiveCategoryId === cat.id && !showingPackages ? "default" : "secondary"}
            size="sm"
            onClick={() => {
              setActiveCategoryId(cat.id);
              setExpandedItemId(null);
            }}
            className="h-9 shrink-0 rounded-full px-4 text-[12.5px] font-bold"
          >
            {cat.name}
          </Button>
        ))}
        {packages && packages.length > 0 && (
          <Button
            variant={showingPackages ? "default" : "secondary"}
            size="sm"
            onClick={() => {
              setActiveCategoryId(PAKET_TAB_ID);
              setExpandedItemId(null);
            }}
            className="h-9 shrink-0 rounded-full px-4 text-[12.5px] font-bold"
          >
            Paket
          </Button>
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
          <DockSummary label={`${activeItemCount} item`} value={formatRupiah(subtotal)}>
            <Button size="lg" onClick={onReview} className="shrink-0 font-bold">
              Lihat Pesanan
            </Button>
          </DockSummary>
        </BottomBar>
      )}
    </>
  );
}
