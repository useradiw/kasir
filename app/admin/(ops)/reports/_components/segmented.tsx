"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex w-full items-center gap-1 rounded-full border border-border bg-input/30 p-1",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Button
            key={opt.value}
            role="tab"
            aria-selected={active}
            variant={active ? "default" : "ghost"}
            size="sm"
            onClick={() => onChange(opt.value)}
            className="flex-1 min-w-0 rounded-full px-2"
          >
            <span className="truncate text-xs sm:text-sm">{opt.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
