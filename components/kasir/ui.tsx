"use client";

import { cn } from "@/lib/utils";
import { ArrowLeft, Minus, Plus, PackageOpen, LayoutList, Delete } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Kasir Top Bar ───────────────────────────────────────────────────────────

export function KasirTopBar({
  title,
  onBack,
  onHome,
  children,
}: {
  title: string;
  onBack?: () => void;
  onHome?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-background px-3">
      {onBack && (
        <button type="button" onClick={onBack} className="p-1 -ml-1">
          <ArrowLeft className="size-5" />
        </button>
      )}
      <span className="flex-1 truncate font-semibold text-sm">{title}</span>
      {children}
      {onHome && (
        <button type="button" onClick={onHome} className="p-1">
          <LayoutList className="size-5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

// ─── Bottom Bar ──────────────────────────────────────────────────────────────

export function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-30 border-t bg-background px-3 py-3 space-y-2">
      {children}
    </div>
  );
}

// ─── Badge ───────────────────────────────────────────────────────────────────

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

// ─── Sync Badge ─────────────────────────────────────────────────────────

export function SyncBadge({ synced }: { synced: 0 | 1 }) {
  return (
    <Badge
      className={
        synced
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
      }
    >
      {synced ? "Synced" : "Belum sync"}
    </Badge>
  );
}

// ─── Qty Control ─────────────────────────────────────────────────────────────

export function QtyControl({
  qty,
  onDecrease,
  onIncrease,
  min = 1,
}: {
  qty: number;
  onDecrease: () => void;
  onIncrease: () => void;
  min?: number;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon-xs"
        onClick={onDecrease}
        disabled={qty <= min}
      >
        <Minus className="size-3" />
      </Button>
      <span className="w-6 text-center text-sm font-medium">{qty}</span>
      <Button variant="outline" size="icon-xs" onClick={onIncrease}>
        <Plus className="size-3" />
      </Button>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

export function EmptyState({
  message,
  icon: Icon = PackageOpen,
}: {
  message: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Icon className="size-10 mb-2 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ─── Numeric Keypad ─────────────────────────────────────────────────────────

const KEYPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "del"] as const;

export function NumericKeypad({
  value,
  onChange,
  maxLength = 10,
}: {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}) {
  const handleKey = (key: (typeof KEYPAD_KEYS)[number]) => {
    if (key === "del") {
      onChange(value.slice(0, -1));
      return;
    }
    const next = value + key;
    // Strip leading zeros (but allow "0" as intermediate)
    const cleaned = next.replace(/^0+/, "") || "";
    if (cleaned.length <= maxLength) {
      onChange(cleaned);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYPAD_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => handleKey(key)}
          className={cn(
            "h-12 rounded-lg border bg-card text-lg font-medium transition-colors active:bg-accent",
            key === "del" && "text-muted-foreground"
          )}
        >
          {key === "del" ? <Delete className="size-5 mx-auto" /> : key}
        </button>
      ))}
    </div>
  );
}
