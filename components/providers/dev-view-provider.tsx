"use client";

import { createContext, useContext, useState } from "react";
import type { RoleEnum } from "@/generated/prisma";
import { DevToolbar } from "@/components/shared/dev-toolbar";

type DevViewCtxValue = {
  isDevMode: boolean;
  realRole: RoleEnum;
  viewAsRole: RoleEnum;
  setViewAsRole: (r: RoleEnum) => void;
};

const DevViewCtx = createContext<DevViewCtxValue | null>(null);

export function DevViewProvider({
  children,
  realRole,
  isDevMode,
}: {
  children: React.ReactNode;
  realRole: RoleEnum;
  isDevMode: boolean;
}) {
  const [viewAsRole, setViewAsRoleState] = useState<RoleEnum>(realRole);

  function setViewAsRole(r: RoleEnum) {
    // Only OWNER can switch views, and only when dev mode is on
    if (!isDevMode || realRole !== "OWNER") return;
    setViewAsRoleState(r);
  }

  return (
    <DevViewCtx.Provider value={{ isDevMode, realRole, viewAsRole, setViewAsRole }}>
      {children}
      <DevToolbar />
    </DevViewCtx.Provider>
  );
}

export function useDevView(): DevViewCtxValue {
  const ctx = useContext(DevViewCtx);
  if (!ctx) throw new Error("useDevView must be used inside DevViewProvider");
  return ctx;
}

/** Safe variant: returns null if no provider in tree (e.g., unauthenticated route). */
export function useDevViewOptional(): DevViewCtxValue | null {
  return useContext(DevViewCtx);
}
