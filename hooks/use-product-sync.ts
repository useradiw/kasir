"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { syncProducts } from "@/app/actions/sync-products";

type SyncStatus = "idle" | "syncing" | "done" | "error";

/**
 * Fetches the full product snapshot from the server and hydrates Dexie.
 * Runs once per browser session (stored in sessionStorage).
 */
export function useProductSync() {
  const [status, setStatus] = useState<SyncStatus>(() =>
    typeof window !== "undefined" && sessionStorage.getItem("products-synced") === "1"
      ? "done"
      : "syncing"
  );
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem("products-synced") === "1") return;

    syncProducts()
      .then(async (snapshot) => {
        await db.transaction(
          "rw",
          [
            db.categories,
            db.menu_items,
            db.menu_variants,
            db.packages,
            db.package_items,
          ],
          async () => {
            await Promise.all([
              db.categories.clear(),
              db.menu_items.clear(),
              db.menu_variants.clear(),
              db.packages.clear(),
              db.package_items.clear(),
            ]);
            await Promise.all([
              db.categories.bulkAdd(snapshot.categories),
              db.menu_items.bulkAdd(snapshot.menuItems),
              db.menu_variants.bulkAdd(snapshot.menuVariants),
              db.packages.bulkAdd(snapshot.packages),
              db.package_items.bulkAdd(snapshot.packageItems),
            ]);
          }
        );

        sessionStorage.setItem("products-synced", "1");
        setStatus("done");
      })
      .catch((err) => {
        console.error("[useProductSync]", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus("error");
      });
  }, []);

  return { status, error };
}
