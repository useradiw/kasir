"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { formatRupiah } from "@/lib/format";

const BILLS = [100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000] as const;

interface DenominationInputProps {
  value: number;
  onChange: (total: number) => void;
}

export function DenominationInput({ value, onChange }: DenominationInputProps) {
  const [counts, setCounts] = useState<Record<number, number>>(() =>
    Object.fromEntries(BILLS.map((d) => [d, 0]))
  );
  const [coinTotal, setCoinTotal] = useState(0);

  const billsTotal = Object.entries(counts).reduce(
    (sum, [denom, qty]) => sum + Number(denom) * qty,
    0
  );

  const handleCountChange = useCallback(
    (denom: number, val: number) => {
      const safe = Math.max(0, val || 0);
      const next = { ...counts, [denom]: safe };
      const newBillsTotal = Object.entries(next).reduce(
        (sum, [d, qty]) => sum + Number(d) * qty,
        0
      );
      setCounts(next);
      onChange(newBillsTotal + coinTotal);
    },
    [counts, coinTotal, onChange]
  );

  const handleCoinChange = useCallback(
    (val: number) => {
      const safe = Math.max(0, val || 0);
      setCoinTotal(safe);
      onChange(billsTotal + safe);
    },
    [billsTotal, onChange]
  );

  return (
    <div className="space-y-3">
      {/* Kertas */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-2">Kertas</p>
        <div className="space-y-1.5">
          {BILLS.map((denom) => {
            const qty = counts[denom] ?? 0;
            const subtotal = denom * qty;
            return (
              <div key={denom} className="flex items-center gap-2">
                <span className="text-sm w-24 shrink-0">{formatRupiah(denom)}</span>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={qty || ""}
                  onChange={(e) => handleCountChange(denom, parseInt(e.target.value, 10))}
                  className="w-20"
                />
                <span
                  className={`ml-auto text-sm tabular-nums ${
                    subtotal > 0 ? "font-medium" : "text-muted-foreground"
                  }`}
                >
                  {formatRupiah(subtotal)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Koin */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-2">Koin</p>
        <Input
          type="number"
          min={0}
          placeholder="0"
          value={coinTotal || ""}
          onChange={(e) => handleCoinChange(parseInt(e.target.value, 10))}
          className="w-44"
        />
      </div>

      {/* Total */}
      <div className="border-t pt-2 flex items-center justify-between">
        <span className="text-sm font-medium">Total</span>
        <span className="text-base font-bold">{formatRupiah(value)}</span>
      </div>
    </div>
  );
}
