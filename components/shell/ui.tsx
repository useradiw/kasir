import { cn } from "@/lib/utils";

/**
 * Presentational primitives of the unified redesign (docs/redesign/SPEC.md).
 * Server-safe (no hooks); interactive pieces live in sheet.tsx.
 */

export function BentoCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

/** Oversized glanceable numeral — the money figure is the hero. */
export function MoneyHero({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("", className)}>
      <CardLabel>{label}</CardLabel>
      <p className="font-display mt-2 text-[clamp(26px,8vw,38px)] font-bold leading-tight tracking-tight tabular-nums">
        {value}
      </p>
      {sub ? <p className="mt-1.5 text-[11.5px] font-semibold text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

type AlertTone = "warn" | "bad" | "info";

const TONE_STYLES: Record<AlertTone, string> = {
  warn: "border-warning/35 bg-warning-soft",
  bad: "border-destructive/35 bg-destructive-soft",
  info: "border-primary/35 bg-primary-soft",
};

/**
 * Every alert explains itself and offers its onward action — badges are never
 * dead-end labels (SPEC rule).
 */
export function AlertRow({
  tone = "warn",
  title,
  detail,
  actionLabel,
  onAction,
  actionHref,
  children,
}: {
  tone?: AlertTone;
  title: React.ReactNode;
  detail?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  children?: React.ReactNode;
}) {
  const btn =
    "shrink-0 rounded-xl px-3.5 py-2.5 text-[12.5px] font-extrabold " +
    (tone === "bad"
      ? "bg-destructive text-white"
      : "bg-primary text-primary-foreground");
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border p-3.5", TONE_STYLES[tone])}>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-bold leading-snug">{title}</p>
        {detail ? (
          <p className="mt-0.5 text-[11.5px] font-semibold leading-snug text-muted-foreground">
            {detail}
          </p>
        ) : null}
      </div>
      {actionHref ? (
        <a href={actionHref} className={btn}>
          {actionLabel}
        </a>
      ) : onAction ? (
        <button type="button" onClick={onAction} className={btn}>
          {actionLabel}
        </button>
      ) : null}
      {children}
    </div>
  );
}

/**
 * One list row — the `.row` pattern from the redesign mockups (screens-buku,
 * screens-buku-forms): title + optional meta on the left, arbitrary content
 * (tag, buttons, select) pinned right. Used by the /buku setup screens for
 * account/category/month lists.
 */
export function Row({
  title,
  meta,
  className,
  children,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5", className)}>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-bold leading-snug">{title}</p>
        {meta ? (
          <p className="mt-0.5 text-[11.5px] font-semibold leading-snug text-muted-foreground">{meta}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function Tag({
  tone = "mut",
  children,
}: {
  tone?: "ok" | "warn" | "bad" | "mut" | "acc";
  children: React.ReactNode;
}) {
  const styles = {
    ok: "bg-success-soft text-success",
    warn: "bg-warning-soft text-warning",
    bad: "bg-destructive-soft text-destructive",
    mut: "bg-card-2 text-muted-foreground border border-border",
    acc: "bg-primary-soft text-primary",
  } as const;
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wide",
        styles[tone],
      )}
    >
      {children}
    </span>
  );
}
