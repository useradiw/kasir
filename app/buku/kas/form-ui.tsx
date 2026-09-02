"use client";

/**
 * Local copy of the tiny Field/todayISO helpers, same duplication
 * app/buku/pengeluaran/form-ui.tsx already carries on purpose (create a new
 * abstraction only at the third duplicate — copying is cheaper than coupling
 * for two small, framework-free helpers).
 */

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11.5px] font-bold text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

/** Today as YYYY-MM-DD (local). */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
