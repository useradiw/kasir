"use client";

import { cn } from "@/lib/utils";

// ─── Error Banner ────────────────────────────────────────────────────────────

export function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
      {error}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

type StatusBadgeProps = {
  active: boolean;
  onClick?: () => void;
  disabled?: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
};

export function StatusBadge({
  active,
  onClick,
  disabled,
  activeLabel,
  inactiveLabel,
}: StatusBadgeProps) {
  const activeText = activeLabel ?? "Aktif";
  const inactiveText = inactiveLabel ?? (onClick ? "Nonaktif" : "Tidak aktif");

  const cls = cn(
    "rounded-full px-2 py-0.5 text-xs font-medium",
    active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
    onClick && "cursor-pointer"
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={cls}>
        {active ? activeText : inactiveText}
      </button>
    );
  }

  return <span className={cls}>{active ? activeText : inactiveText}</span>;
}

// ─── Page Header ──────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </div>
  );
}
