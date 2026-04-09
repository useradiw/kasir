import { Container } from "@/components/shared/container";
import { requireOwner } from "@/lib/admin-auth";
import BackupClient from "./backup-client";

export default async function BackupPage() {
  await requireOwner();

  return (
    <Container id="admin-backup" sectionStyle="" className="py-6">
      <BackupClient />
    </Container>
  );
}
