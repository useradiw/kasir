"use client";

import { useState, useEffect } from "react";

const FALLBACK_COLORS = ["#0d9488", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export function useChartColors(count: number): string[] {
  const [colors, setColors] = useState<string[]>(FALLBACK_COLORS.slice(0, count));
  useEffect(() => {
    const s = getComputedStyle(document.documentElement);
    const resolved = Array.from({ length: count }, (_, i) => {
      const v = s.getPropertyValue(`--chart-${i + 1}`).trim();
      return v || FALLBACK_COLORS[i % FALLBACK_COLORS.length];
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColors(resolved);
  }, [count]);
  return colors;
}
