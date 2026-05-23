import { Container } from "@/components/shared/container";
import { requireRole } from "@/lib/admin-auth";
import { getKasPakHarData } from "@/app/actions/admin/kas-pak-har";
import KasPakHarClient from "./kas-pak-har-client";

export default async function KasPakHarPage() {
  const staff = await requireRole("OWNER", "MANAGER");
  const data = await getKasPakHarData();

  return (
    <Container id="admin-kas-pak-har" sectionStyle="" className="py-6">
      <KasPakHarClient data={data} isOwner={staff.role === "OWNER" || staff.role === "DEVELOPER"} />
    </Container>
  );
}
