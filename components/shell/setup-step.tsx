"use client";

import { useAdminAction } from "@/hooks/use-admin-action";
import { seedDefaultCategories, seedStructuralChart } from "@/app/actions/admin/keuangan";
import { cn } from "@/lib/utils";

/**
 * One checklist row. done steps are struck through; the active step's action
 * button is rendered by the parent via `action`.
 */
export function SetupStep({
  index,
  done,
  label,
  detail,
  action,
  actionHref,
  isNext,
}: {
  index: number;
  done: boolean;
  label: string;
  detail: string;
  action?: "seed-accounts" | "seed-categories";
  actionHref?: string;
  isNext: boolean;
}) {
  const { isPending, run } = useAdminAction();

  const dot = (
    <span
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-lg border-2 text-xs font-extrabold",
        done
          ? "border-primary bg-primary text-primary-foreground"
          : isNext
            ? "border-primary text-primary"
            : "border-border bg-card-2 text-muted-foreground",
      )}
    >
      {done ? "✓" : index}
    </span>
  );

  return (
    <div className="flex items-start gap-3 border-b border-border px-3.5 py-3 last:border-b-0">
      {dot}
      <div className="min-w-0 flex-1">
        <h4
          className={cn(
            "text-[13.5px] font-bold",
            done && "text-muted-foreground line-through",
          )}
        >
          {label}
        </h4>
        <p className="mt-0.5 text-xs font-semibold leading-snug text-muted-foreground">
          {detail}
        </p>
      </div>
      {!done && isNext && action === "seed-accounts" ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            run(async () => {
              await seedStructuralChart();
            })
          }
          className="cursor-pointer shrink-0 self-center rounded-xl bg-primary px-3.5 py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-50"
        >
          {isPending ? "…" : "Isi default"}
        </button>
      ) : null}
      {!done && isNext && action === "seed-categories" ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            run(async () => {
              await seedDefaultCategories();
            })
          }
          className="cursor-pointer shrink-0 self-center rounded-xl bg-primary px-3.5 py-2.5 text-xs font-extrabold text-primary-foreground disabled:opacity-50"
        >
          {isPending ? "…" : "Isi default"}
        </button>
      ) : null}
      {!done && isNext && actionHref ? (
        <a
          href={actionHref}
          className="shrink-0 self-center rounded-xl bg-primary px-3.5 py-2.5 text-xs font-extrabold text-primary-foreground"
        >
          Lanjut →
        </a>
      ) : null}
    </div>
  );
}
