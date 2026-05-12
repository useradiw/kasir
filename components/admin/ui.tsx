"use client";

import { cn } from "@/lib/utils";

// Re-export shared components so admin pages keep working
export { ErrorBanner, PageHeader as AdminPageHeader } from "@/components/shared/ui";
export { StatusBadge, RoleBadge } from "@/components/shared/badge";

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
