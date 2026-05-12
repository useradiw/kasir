import { Container } from "@/components/shared/container";
import { requireRole } from "@/lib/admin-auth";
import { getSettlementData } from "@/app/actions/admin/queries";
import { SettlementClient } from "@/app/settlement/settlement-client";

export default async function AdminSettlementPage() {
  const staff = await requireRole("OWNER", "MANAGER");
  const data = await getSettlementData();

  return (
    <Container id="admin-settlement" sectionStyle="" className="!max-w-4xl py-6">
      <SettlementClient data={data} staffRole={staff.role} backHref="/admin" />
    </Container>
  );
}
