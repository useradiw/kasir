import { Container } from "@/components/shared/container";
import { getInventoryData } from "@/app/actions/admin/queries";
import InventoryClient from "./inventory-client";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab = "categories" } = await searchParams;
  const data = await getInventoryData();

  return (
    <Container id="admin-inventory" sectionStyle="" className="!max-w-4xl py-6">
      <InventoryClient tab={tab} {...data} />
    </Container>
  );
}
