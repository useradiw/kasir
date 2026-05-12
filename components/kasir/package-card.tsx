"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { addOrderItem } from "@/hooks/use-session-store";
import { formatRupiah } from "@/lib/format";
import { QtyControl, EmptyState } from "./ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

export function PackageGrid({
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
