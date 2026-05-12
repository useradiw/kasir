"use client";

// Re-export badges from unified badge module
export { StatusBadge } from "@/components/shared/badge";

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
