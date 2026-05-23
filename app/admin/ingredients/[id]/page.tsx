import { Container } from "@/components/shared/container";
import { requireRole } from "@/lib/admin-auth";
import {
  getIngredientDetail,
  getIngredientPurchaseHistory,
  getIngredientLogs,
  getIngredientRecipe,
  getActiveIngredientsLite,
  getUnlinkedExpenseItems,
} from "@/app/actions/admin/queries/ingredient-queries";
import IngredientDetailClient from "./ingredient-detail-client";

export default async function IngredientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole("OWNER", "MANAGER");
  const { id }       = await params;
  const { tab = "pembelian" } = await searchParams;

  const [detail, purchases, logs, recipe, ingredientOptions, unlinkedItems] = await Promise.all([
    getIngredientDetail(id),
    getIngredientPurchaseHistory(id, 60),
    getIngredientLogs(id, 80),
    getIngredientRecipe(id),
    getActiveIngredientsLite(),
    getUnlinkedExpenseItems(),
  ]);

  return (
    <Container id="ingredient-detail" sectionStyle="" className="py-6">
      <IngredientDetailClient
        detail={detail}
        purchases={purchases}
        logs={logs}
        recipe={recipe}
        ingredientOptions={ingredientOptions}
        unlinkedItems={unlinkedItems}
        tab={tab}
      />
    </Container>
  );
}
