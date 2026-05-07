"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import BackupClient from "./backup-client";
import RestoreClient from "./restore-client";

const TABS = [
  { key: "export", label: "Export" },
  { key: "import", label: "Import / Restore" },
] as const;

export default function BackupTabsClient() {
  const [tab, setTab] = useState<"export" | "import">("export");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Backup Database</h1>

      <div className="flex gap-2 border-b border-foreground/10">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === t.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "export" ? <BackupClient /> : <RestoreClient />}
    </div>
  );
}
