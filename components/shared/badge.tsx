"use client";

import { cn } from "@/lib/utils";

// ─── Base Badge ─────────────────────────────────────────────────────────────

const badgeBase = "rounded-full px-2 py-0.5 text-xs font-medium";

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn(badgeBase, className)}>
      {children}
    </span>
  );
}

// ─── Role Badge ─────────────────────────────────────────────────────────────

const roleBadgeClass: Record<string, string> = {
  OWNER: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  MANAGER: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  CASHIER: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  STAFF: "bg-muted text-muted-foreground",
};

export function RoleBadge({ role }: { role: string }) {
  return (
    <Badge className={roleBadgeClass[role] ?? "bg-muted text-muted-foreground"}>
      {role}
    </Badge>
  );
}

// ─── Status Badge ───────────────────────────────────────────────────────────

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
    badgeBase,
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

// ─── Sync Badge ─────────────────────────────────────────────────────────────

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
