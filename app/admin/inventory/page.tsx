import { Container } from "@/components/shared/container";
import { getInventoryData, getRecipeData } from "@/app/actions/admin/queries";
import { requireRole } from "@/lib/admin-auth";
import InventoryClient from "./inventory-client";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const staff = await requireRole("OWNER", "MANAGER");
  const { tab = "categories" } = await searchParams;
  const [data, recipeData] = await Promise.all([getInventoryData(), getRecipeData()]);

  return (
    <Container id="admin-inventory" sectionStyle="" className="py-6">
      <InventoryClient
        tab={tab}
        {...data}
        templates={recipeData.templates}
        recipes={recipeData.recipes}
        isOwner={staff.role === "OWNER"}
      />
    </Container>
  );
}
