import { Container } from "@/components/shared/container";
import { requireRole } from "@/lib/admin-auth";
import {
  getAssembledIngredientsIndex,
  getActiveIngredientsLite,
} from "@/app/actions/admin/queries/ingredient-queries";
import ResepOlahanClient from "./resep-olahan-client";

export default async function ResepOlahanPage() {
  await requireRole("OWNER", "MANAGER");
  const [data, allActive] = await Promise.all([
    getAssembledIngredientsIndex(),
    getActiveIngredientsLite(),
  ]);
  return (
    <Container id="admin-resep-olahan" sectionStyle="" className="py-6">
      <ResepOlahanClient data={data} allActive={allActive} />
    </Container>
  );
}
