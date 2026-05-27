"use client";

import { useState } from "react";
import { useDevView } from "@/components/providers/dev-view-provider";
import { Button } from "@/components/ui/button";
import type { RoleEnum } from "@/generated/prisma";

const ROLES: RoleEnum[] = ["OWNER", "MANAGER", "CASHIER", "STAFF"];

const ROLE_LABEL: Record<RoleEnum, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  CASHIER: "Kasir",
  STAFF: "Staff",
  DEVELOPER: "Developer",
};

export function DevToolbar() {
  const { isDevMode, realRole, viewAsRole, setViewAsRole } = useDevView();
  const [minimized, setMinimized] = useState(false);

  // Only visible to actual OWNER / DEVELOPER with dev mode on
  if (!isDevMode || (realRole !== "OWNER" && realRole !== "DEVELOPER")) return null;

  const isViewingAs = viewAsRole !== realRole;

  if (minimized) {
    return (
      <Button
        variant="outline"
        size="icon"
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-50 size-10 rounded-full shadow-lg"
        title="Dev Mode"
        aria-label="Dev Mode"
      >
        <span
          className={`size-3 rounded-full ${isViewingAs ? "bg-amber-400" : "bg-green-500"}`}
        />
      </Button>
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMinimized(true)}
          className="text-muted-foreground hover:text-foreground text-xs leading-none h-auto p-0.5"
          aria-label="Minimize"
        >
          ✕
        </Button>
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
        <Button
          variant="link"
          size="sm"
          onClick={() => setViewAsRole(realRole)}
          className="text-xs text-primary h-auto p-0 w-full justify-start"
        >
          Kembali ke {ROLE_LABEL[realRole]}
        </Button>
      )}
    </div>
  );
}
