import { Container } from "@/components/shared/container";
import { getStaffWithEmails } from "@/app/actions/admin/queries";
import StaffClient from "./staff-client";

export default async function StaffPage() {
  const staffList = await getStaffWithEmails();

  return (
    <Container id="admin-staff" sectionStyle="" className="py-6">
      <StaffClient staffList={staffList} />
    </Container>
  );
}
