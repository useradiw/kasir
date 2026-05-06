"use client";

import { useState } from "react";
import { useDevView } from "@/components/providers/dev-view-provider";
import type { RoleEnum } from "@/generated/prisma";

const ROLES: RoleEnum[] = ["OWNER", "MANAGER", "CASHIER", "STAFF"];

const ROLE_LABEL: Record<RoleEnum, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  CASHIER: "Kasir",
  STAFF: "Staff",
};

export function DevToolbar() {
  const { isDevMode, realRole, viewAsRole, setViewAsRole } = useDevView();
  const [minimized, setMinimized] = useState(false);

  // Only visible to actual OWNER with dev mode on
  if (!isDevMode || realRole !== "OWNER") return null;

  const isViewingAs = viewAsRole !== realRole;

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-50 size-10 rounded-full bg-background border shadow-lg flex items-center justify-center text-sm"
        title="Dev Mode"
      >
        <span
          className={`size-3 rounded-full ${isViewingAs ? "bg-amber-400" : "bg-green-500"}`}
        />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-background border rounded-xl shadow-lg p-3 min-w-44 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`size-2.5 rounded-full shrink-0 ${isViewingAs ? "bg-amber-400" : "bg-green-500"}`}
          />
          <span className="text-xs font-semibold text-muted-foreground">Dev Mode</span>
        </div>
        <button
          onClick={() => setMinimized(true)}
          className="text-muted-foreground hover:text-foreground text-xs leading-none"
          title="Minimize"
        >
          ✕
        </button>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Lihat sebagai:</p>
        <select
          value={viewAsRole}
          onChange={(e) => setViewAsRole(e.target.value as RoleEnum)}
          className="w-full h-8 rounded-md border border-input bg-input/30 px-2 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}{r === realRole ? " (Kamu)" : ""}
            </option>
          ))}
        </select>
      </div>

      {isViewingAs && (
        <button
          onClick={() => setViewAsRole(realRole)}
          className="text-xs text-primary underline w-full text-left"
        >
          Kembali ke {ROLE_LABEL[realRole]}
        </button>
      )}
    </div>
  );
}
