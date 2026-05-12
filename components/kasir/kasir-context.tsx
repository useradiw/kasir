"use client";

import { createContext, useContext } from "react";
import type { StoreInfo } from "@/lib/settings";

export type KasirContextValue = {
  staffId: string;
  staffName: string;
  staffRole: string;
  storeInfo: StoreInfo;
  defaultTaxPct: number;
  defaultServicePct: number;
};

const KasirContext = createContext<KasirContextValue | null>(null);

export function KasirProvider({
  value,
  children,
}: {
  value: KasirContextValue;
  children: React.ReactNode;
}) {
  return <KasirContext.Provider value={value}>{children}</KasirContext.Provider>;
}

/**
 * Access kasir context (staff info, store config, defaults).
 * Must be used inside a <KasirProvider>.
 */
export function useKasir(): KasirContextValue {
  const ctx = useContext(KasirContext);
  if (!ctx) throw new Error("useKasir must be used inside <KasirProvider>");
  return ctx;
}
