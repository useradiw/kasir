"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

// Indonesian users type "0,03" with a comma. <input type="number"> only ever
// accepts a dot and silently rejects the comma — so this control uses a text
// input, displays the comma, and emits a hidden dot-normalized field so server
// parsing (z.coerce.number / parseFloat) keeps working unchanged.

function toDisplay(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  return String(n).replace(".", ",");
}

function toNumber(text: string): number | null {
  const t = text.replace(",", ".");
  if (t === "" || t === "-" || t === ".") return null;
  const n = parseFloat(t);
  return Number.isNaN(n) ? null : n;
}

function sanitize(raw: string, allowNegative: boolean, maxDecimals: number): string {
  const negative = allowNegative && raw.trimStart().startsWith("-");
  let s = raw.replace(/\./g, ",").replace(/[^0-9,]/g, "");
  const first = s.indexOf(",");
  if (first !== -1) {
    const intPart = s.slice(0, first);
    const decPart = s.slice(first + 1).replace(/,/g, "").slice(0, maxDecimals);
    s = `${intPart},${decPart}`;
  }
  return (negative ? "-" : "") + s;
}

export type DecimalInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "defaultValue" | "onChange" | "inputMode"
> & {
  name?: string;
  defaultValue?: number | null;
  onValueChange?: (value: number | null) => void;
  allowNegative?: boolean;
  maxDecimals?: number;
};

export function DecimalInput({
  name,
  defaultValue,
  onValueChange,
  allowNegative = false,
  maxDecimals = 2,
  ...props
}: DecimalInputProps) {
  const [text, setText] = React.useState(() => toDisplay(defaultValue));

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = sanitize(e.target.value, allowNegative, maxDecimals);
    setText(next);
    onValueChange?.(toNumber(next));
  }

  return (
    <>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        value={text}
        onChange={handleChange}
      />
      {name && <input type="hidden" name={name} value={text.replace(",", ".")} />}
    </>
  );
}
