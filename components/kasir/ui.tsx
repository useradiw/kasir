"use client";

import { cn } from "@/lib/utils";
import { ArrowLeft, Minus, Plus, PackageOpen, LayoutList, Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/container";

// ─── Kasir Top Bar ───────────────────────────────────────────────────────────

/**
 * Screen header for the POS views — the topbar in docs/redesign/screens-jual.html.
 * `sub` carries the context line (session, shift) the mockup puts under the
 * title; every view that has one should pass it.
 */
export function KasirTopBar({
  title,
  sub,
  onBack,
  onHome,
  children,
}: {
  title: string;
  sub?: string;
  onBack?: () => void;
  onHome?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Container
      id="kasirtopbar"
      className="sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b border-border bg-background px-3 py-2"
    >
      {onBack && (
        <button type="button" onClick={onBack} className="cursor-pointer p-2.5 -ml-2.5" aria-label="Kembali">
          <ArrowLeft className="size-5" />
        </button>
      )}
      <span className="min-w-0 flex-1">
        <span className="font-display block truncate text-[17px] font-bold leading-tight">{title}</span>
        {sub && (
          <span className="block truncate text-[11.5px] font-semibold text-muted-foreground">
            {sub}
          </span>
        )}
      </span>
      {children}
      {onHome && (
        <button type="button" onClick={onHome} className="cursor-pointer p-2.5" aria-label="Daftar sesi">
          <LayoutList className="size-5 text-muted-foreground" />
        </button>
      )}
    </Container>
  );
}

// ─── Bottom Bar ──────────────────────────────────────────────────────────────

/**
 * The pinned dock at the foot of a POS view. The redesign floats it as a card
 * over the content instead of ruling a line across the screen, so the cart
 * total reads as an object you act on rather than a footer.
 */
export function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <Container
      id="kasirbottombar"
      className="sticky bottom-0 z-30 space-y-2 bg-gradient-to-t from-background via-background to-transparent px-3 pb-3 pt-4"
    >
      {children}
    </Container>
  );
}

/**
 * Dock contents: a label/figure pair on the left, the action on the right.
 * Money is Sora + tabular-nums, as every figure in the system is.
 */
export function DockSummary({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 pl-4">
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-extrabold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="font-display truncate text-[19px] font-bold tabular-nums">{value}</p>
      </div>
      {children}
    </div>
  );
}

// ─── Badge (re-exported from shared) ────────────────────────────────────────

export { Badge, SyncBadge } from "@/components/shared/badge";

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
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="icon-lg"
        onClick={onDecrease}
        disabled={qty <= min}
        aria-label="Kurangi jumlah"
      >
        <Minus className="size-4" />
      </Button>
      <span className="font-display w-7 text-center text-[15px] font-bold tabular-nums">{qty}</span>
      <Button variant="outline" size="icon-lg" onClick={onIncrease} aria-label="Tambah jumlah">
        <Plus className="size-4" />
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
        <Button
          key={key}
          variant="outline"
          onClick={() => handleKey(key)}
          className={cn(
            "font-display h-14 rounded-xl text-[19px] font-bold tabular-nums",
            key === "del" && "text-muted-foreground"
          )}
        >
          {key === "del" ? <Delete className="size-5" /> : key}
        </Button>
      ))}
    </div>
  );
}
