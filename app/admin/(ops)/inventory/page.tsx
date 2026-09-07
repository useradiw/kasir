import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { NotificationBellServer } from "@/components/shared/notification-bell-server";
import { getInventoryData } from "@/app/actions/admin/queries";
import { requireCan } from "@/lib/admin-auth";
import InventoryClient from "./inventory-client";

const VALID_TABS = ["categories", "items", "variants", "packages", "online", "takeaway"];

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const staff = await requireCan("menu.read");
  const { tab } = await searchParams;
  // Unknown or retired tabs (e.g. old bookmarks) fall back to the first tab
  // instead of rendering an empty page.
  const activeTab = tab && VALID_TABS.includes(tab) ? tab : "categories";
  const data = await getInventoryData();

  return (
    <AppShell role={staff.role}>
      <div className="flex items-start justify-between px-4 pb-1 pt-6">
        <div>
          <Link href="/admin" className="cursor-pointer text-[12.5px] font-bold text-muted-foreground">
            ← Admin
          </Link>
          <h1 className="font-display mt-2 text-[17px] font-bold">Menu Management</h1>
          <p className="text-[11.5px] font-semibold text-muted-foreground">
            {data.categories.length} kategori · {data.menuItems.length} menu
          </p>
        </div>
        <NotificationBellServer staffId={staff.id} />
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        <InventoryClient
          tab={activeTab}
          {...data}
          isOwner={staff.role === "OWNER" || staff.role === "DEVELOPER"}
        />
      </div>
    </AppShell>
  );
}
