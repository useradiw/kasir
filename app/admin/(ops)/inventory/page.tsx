import { Container } from "@/components/shared/container";
import { getInventoryData } from "@/app/actions/admin/queries";
import { requireRole } from "@/lib/admin-auth";
import InventoryClient from "./inventory-client";

const VALID_TABS = ["categories", "items", "variants", "packages", "online"];

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const staff = await requireRole("OWNER", "MANAGER");
  const { tab } = await searchParams;
  // The "recipes" tab was removed in the COGS strip; old bookmarks fall back
  // to the first tab instead of rendering an empty page.
  const activeTab = tab && VALID_TABS.includes(tab) ? tab : "categories";
  const data = await getInventoryData();

  return (
    <Container id="admin-inventory" sectionStyle="" className="py-6">
      <InventoryClient
        tab={activeTab}
        {...data}
        isOwner={staff.role === "OWNER" || staff.role === "DEVELOPER"}
      />
    </Container>
  );
}
