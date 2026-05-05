import { Container } from "@/components/shared/container";
import { requireOwner } from "@/lib/admin-auth";
import { getKasPakHarData } from "@/app/actions/admin/kas-pak-har";
import KasPakHarClient from "./kas-pak-har-client";

export default async function KasPakHarPage() {
  await requireOwner();
  const data = await getKasPakHarData();

  return (
    <Container id="admin-kas-pak-har" sectionStyle="" className="py-6">
      <KasPakHarClient data={data} />
    </Container>
  );
}
