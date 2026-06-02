import { Container } from "@/components/shared/container";
import { prisma } from "@/lib/prisma";
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
  const staff = await requireRole("OWNER", "MANAGER");
  const { id }       = await params;
  const { tab = "pembelian" } = await searchParams;
  // Rescale is OWNER-only (requireOwnerStrict on the server blocks DEVELOPER too).
  const isOwner = staff.role === "OWNER";

  const [detail, purchases, logs, recipe, ingredientOptions, unlinkedItems, suppliers] = await Promise.all([
    getIngredientDetail(id),
    getIngredientPurchaseHistory(id, 60),
    getIngredientLogs(id, 80),
    getIngredientRecipe(id),
    getActiveIngredientsLite(),
    getUnlinkedExpenseItems(),
    prisma.supplier.findMany({
      where:   { isActive: true },
      orderBy: { name: "asc" },
      select:  { id: true, name: true },
    }),
  ]);

  // A plain unit relabel is only safe with no history (use "Ubah Satuan" otherwise)
  const [purchaseCount, logCount, recipeIngCount, componentCount] = await Promise.all([
    prisma.ingredientPurchase.count({ where: { ingredientId: id } }),
    prisma.ingredientLog.count({ where: { ingredientId: id } }),
    prisma.recipeIngredient.count({ where: { ingredientId: id } }),
    prisma.ingredientRecipeItem.count({ where: { ingredientId: id } }),
  ]);
  const hasHistory =
    purchaseCount > 0 || logCount > 0 || recipeIngCount > 0 ||
    componentCount > 0 || detail.currentStock !== 0;

  return (
    <Container id="ingredient-detail" sectionStyle="" className="py-6">
      <IngredientDetailClient
        detail={detail}
        purchases={purchases}
        logs={logs}
        recipe={recipe}
        ingredientOptions={ingredientOptions}
        unlinkedItems={unlinkedItems}
        suppliers={suppliers}
        hasHistory={hasHistory}
        isOwner={isOwner}
        tab={tab}
      />
    </Container>
  );
}
