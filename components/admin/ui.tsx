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

// ─── Admin Select ────────────────────────────────────────────────────────────
// Styled <select> matching the project's pill-shaped input style.

export function AdminSelect({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm",
        className
      )}
      {...props}
    />
  );
}

// ─── Role Badge ───────────────────────────────────────────────────────────────

const roleBadgeClass: Record<string, string> = {
  OWNER:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  MANAGER:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  CASHIER:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  STAFF: "bg-muted text-muted-foreground",
};

export function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        roleBadgeClass[role] ?? "bg-muted text-muted-foreground"
      )}
    >
      {role}
    </span>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
// Pass onClick to make it an interactive toggle. Provide custom labels as needed.

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
  const activeText = activeLabel ?? (onClick ? "Aktif" : "Aktif");
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

// ─── Admin Page Header ────────────────────────────────────────────────────────
// Top-of-page title row with optional right-side slot.

export function AdminPageHeader({
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

// ─── Table Empty Row ──────────────────────────────────────────────────────────
// Drop inside <tbody> when the list is empty.

export function TableEmptyRow({
  colSpan,
  message,
}: {
  colSpan: number;
  message: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-4 text-center text-muted-foreground">
        {message}
      </td>
    </tr>
  );
}
