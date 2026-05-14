import { Container } from "@/components/shared/container";
import { requireRole } from "@/lib/admin-auth";
import { getIngredientStockData } from "@/app/actions/admin/queries";
import IngredientsClient from "./ingredients-client";

export default async function IngredientsPage() {
  await requireRole("OWNER", "MANAGER");
  const data = await getIngredientStockData();

  return (
    <Container id="admin-ingredients" sectionStyle="" className="py-6">
      <IngredientsClient data={data} />
    </Container>
  );
}
