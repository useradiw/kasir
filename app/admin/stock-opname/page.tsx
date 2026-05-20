import { Container } from "@/components/shared/container";
import { requireRole } from "@/lib/admin-auth";
import { getOpnameHistory, getOpnameIngredients } from "@/app/actions/admin/opname";
import OpnameClient from "./opname-client";

export default async function StockOpnamePage() {
  await requireRole("OWNER", "MANAGER");

  const [history, ingredients] = await Promise.all([
    getOpnameHistory(),
    getOpnameIngredients(),
  ]);

  return (
    <Container id="admin-stock-opname" sectionStyle="" className="py-6">
      <OpnameClient history={history} ingredients={ingredients} />
    </Container>
  );
}
