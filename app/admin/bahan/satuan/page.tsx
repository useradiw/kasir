import { Container } from "@/components/shared/container";
import { requireOwner } from "@/lib/admin-auth";
import { getUnitSettingsView } from "@/app/actions/admin/unit-settings";
import SatuanClient from "./satuan-client";

export default async function UnitSettingsPage() {
  await requireOwner();
  const view = await getUnitSettingsView();

  return (
    <Container id="admin-unit-settings" sectionStyle="" className="py-6">
      <SatuanClient initial={view} />
    </Container>
  );
}
