"use client";

import { cn } from "@/lib/utils";

// Re-export badges from unified badge module
export { StatusBadge } from "@/components/shared/badge";

// ─── Tab Bar ────────────────────────────────────────────────────────────────

export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex border-b", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={cn(
            "flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors",
            value === tab.value
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Error Banner ────────────────────────────────────────────────────────────

export function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
      {error}
    </div>
  );
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
