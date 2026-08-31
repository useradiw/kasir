"use client";

import { cn } from "@/lib/utils";

/** Segmented switcher — Item/Favorit/Keypad, Tunai/QRIS/Split, etc. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange?: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1 rounded-2xl border border-border bg-card p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange?.(o.value)}
          className={cn(
            "flex-1 rounded-xl px-3 py-2.5 text-[13px] font-bold",
            value === o.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Numeric keypad — Sora digits, 44px+ targets. */
export function NumKeypad({
  onDigit,
  onBackspace,
  onConfirm,
}: {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onConfirm?: () => void;
}) {
  const key =
    "rounded-xl border border-border bg-card py-3.5 text-center font-display text-lg font-bold active:scale-[0.98] transition-all duration-150";
  return (
    <div className="grid grid-cols-3 gap-2">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
        <button key={d} type="button" className={key} onClick={() => onDigit(d)}>
          {d}
        </button>
      ))}
      <button type="button" className={cn(key, "text-xs font-bold text-muted-foreground")} onClick={onBackspace}>
        ← hapus
      </button>
      <button type="button" className={key} onClick={() => onDigit("0")}>
        0
      </button>
      <button
        type="button"
        className={cn(key, "border-primary bg-primary text-primary-foreground")}
        onClick={onConfirm}
      >
        ✓
      </button>
    </div>
  );
}

/** Quick-cash chips — "uang pas" plus common denominations. */
export function QuickCash({
  amounts,
  onPick,
  exactLabel = "Uang pas",
}: {
  amounts: number[];
  onPick: (amount: number | "exact") => void;
  exactLabel?: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <button
        type="button"
        onClick={() => onPick("exact")}
        className="rounded-lg border border-primary bg-primary-soft px-1 py-3.5 text-center font-display text-[13px] font-bold text-primary"
      >
        {exactLabel}
      </button>
      {amounts.map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => onPick(a)}
          className="rounded-lg border border-border bg-card px-1 py-3.5 text-center font-display text-[13px] font-bold"
        >
          {a.toLocaleString("id-ID")}
        </button>
      ))}
    </div>
  );
}

/** Pinned cart dock — thumb-range CTA above the tab bar. */
export function Dock({
  top,
  bottom,
  actionLabel,
  onAction,
}: {
  top: string;
  bottom: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="sticky bottom-20 z-20 mx-3 flex items-center rounded-2xl bg-foreground py-2 pl-4 pr-2 text-background shadow-lg shadow-black/40">
      <div>
        <p className="text-[10.5px] font-bold uppercase tracking-wide opacity-65">{top}</p>
        <p className="font-display text-[17px] font-bold tabular-nums">{bottom}</p>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="ml-auto rounded-xl bg-primary px-5 py-3.5 text-[14.5px] font-extrabold text-primary-foreground active:scale-[0.98] transition-all duration-150"
      >
        {actionLabel}
      </button>
    </div>
  );
}
