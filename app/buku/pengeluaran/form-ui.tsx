"use client";

/**
 * Local copies of the old form's tiny helpers (Field label wrapper,
 * todayISO), kept in this folder rather than imported from
 * app/admin/keuangan/_components/form-ui.tsx — that folder is slated for
 * deletion once every /buku equivalent exists (docs/redesign/plan-open-items.md
 * section 1), and neither components/shell/* nor components/admin/ui has an
 * equivalent Field wrapper today.
 */

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11.5px] font-bold text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] font-semibold text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Today as YYYY-MM-DD (local). */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
