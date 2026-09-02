"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import BackupClient from "./backup-client";
import RestoreClient from "./restore-client";

const TABS = [
  { key: "export", label: "Export" },
  { key: "import", label: "Import / Restore" },
] as const;

export default function BackupTabsClient() {
  const [tab, setTab] = useState<"export" | "import">("export");

  return (
    <>
      <div className="flex gap-1.5">
        {TABS.map((t) => (
          <Button
            key={t.key}
            type="button"
            size="sm"
            variant={tab === t.key ? "default" : "outline"}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "export" ? <BackupClient /> : <RestoreClient />}
    </>
  );
}
