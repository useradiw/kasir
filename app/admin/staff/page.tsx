import { Container } from "@/components/shared/container";
import { getStaffWithEmails } from "@/app/actions/admin/queries";
import { requireRole } from "@/lib/admin-auth";
import StaffClient from "./staff-client";

export default async function StaffPage() {
  const staff = await requireRole("OWNER", "MANAGER");
  const staffList = await getStaffWithEmails();

  return (
    <Container id="admin-staff" sectionStyle="" className="py-6">
      <StaffClient staffList={staffList} isOwner={staff.role === "OWNER"} />
    </Container>
  );
}
