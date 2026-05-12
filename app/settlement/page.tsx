import { Container } from "@/components/shared/container";
import { requireRole } from "@/lib/admin-auth";
import { getSettlementData } from "@/app/actions/admin/queries";
import { SettlementClient } from "./settlement-client";

export default async function SettlementPage() {
  const staff = await requireRole("OWNER", "MANAGER", "CASHIER");
  const data = await getSettlementData();

  return (
    <Container id="settlement" className="py-6">
      <SettlementClient data={data} staffRole={staff.role} />
    </Container>
  );
}
