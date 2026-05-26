import { Container } from "@/components/shared/container";
import { requireRole } from "@/lib/admin-auth";
import { getInventoryData, getRecipeData } from "@/app/actions/admin/queries";
import ResepMenuClient from "./resep-menu-client";

export default async function ResepMenuPage() {
  const staff = await requireRole("OWNER", "MANAGER");
  const [inv, recipeData] = await Promise.all([getInventoryData(), getRecipeData()]);
  return (
    <Container id="admin-resep-menu" sectionStyle="" className="py-6">
      <ResepMenuClient
        ingredients={recipeData.ingredients}
        recipes={recipeData.recipes}
        menuItems={inv.menuItems}
        variants={inv.variants}
        isOwner={staff.role === "OWNER" || staff.role === "DEVELOPER"}
      />
    </Container>
  );
}
