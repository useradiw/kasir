"use client";

import { useQuery } from "@tanstack/react-query";
import { getStaffId } from "@/app/actions/get-staff-id";
import { syncProducts } from "@/app/actions/sync-products";
import { db } from "@/lib/db";

/** Cached staff identity — fetched once, never refetches automatically. */
export function useStaffId() {
  return useQuery({
    queryKey: ["staff-id"],
    queryFn: () => getStaffId(),
    staleTime: Infinity,
    retry: 1,
  });
}

/** Product sync with TanStack Query for better loading/error/retry states. */
export function useProductSyncQuery() {
  return useQuery({
    queryKey: ["product-sync"],
    queryFn: async () => {
      const snapshot = await syncProducts();
      await db.transaction(
        "rw",
        [db.categories, db.menu_items, db.menu_variants, db.packages, db.package_items],
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
      return true;
    },
    staleTime: Infinity,
    retry: 2,
  });
}
