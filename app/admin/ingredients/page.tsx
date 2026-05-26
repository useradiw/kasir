import { Container } from "@/components/shared/container";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";
import { getIngredientStockData } from "@/app/actions/admin/queries";
import { getSettings } from "@/lib/settings";
import { resolveBaseUnit } from "@/lib/unit-class";
import IngredientsClient from "./ingredients-client";

export default async function IngredientsPage() {
  const staff = await requireRole("OWNER", "MANAGER");
  const isOwner = staff.role === "OWNER" || staff.role === "DEVELOPER";
  const [data, suppliers, settings] = await Promise.all([
    getIngredientStockData(),
    prisma.supplier.findMany({
      where:   { isActive: true },
      orderBy: { name: "asc" },
      select:  { id: true, name: true },
    }),
    getSettings(),
  ]);
  const resolvedBaseUnits = {
    WEIGHT: resolveBaseUnit("WEIGHT", settings),
    VOLUME: resolveBaseUnit("VOLUME", settings),
    COUNT:  resolveBaseUnit("COUNT", settings),
  };

  return (
    <Container id="admin-ingredients" sectionStyle="" className="py-6">
      <IngredientsClient
        data={data}
        suppliers={suppliers}
        resolvedBaseUnits={resolvedBaseUnits}
        isOwner={isOwner}
      />
    </Container>
  );
}
