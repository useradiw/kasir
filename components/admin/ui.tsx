"use client";

import { cn } from "@/lib/utils";

// Re-export shared components so admin pages keep working
export { ErrorBanner, StatusBadge, PageHeader as AdminPageHeader } from "@/components/shared/ui";

// ─── Admin Select ────────────────────────────────────────────────────────────

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

// ─── Table Empty Row ──────────────────────────────────────────────────────────

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
