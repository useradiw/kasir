import { Container } from "@/components/shared/container";
import { requireOwner } from "@/lib/admin-auth";
import BackupTabsClient from "./backup-tabs-client";

export default async function BackupPage() {
  await requireOwner();

  return (
    <Container id="admin-backup" sectionStyle="" className="py-6">
      <BackupTabsClient />
    </Container>
  );
}
