import { Container } from "@/components/shared/container";
import { getAttendanceData } from "@/app/actions/admin/queries";
import { requireRole } from "@/lib/admin-auth";
import AttendanceClient from "./attendance-client";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireRole("OWNER", "MANAGER");
  const params = await searchParams;
  const date = params.date ?? "";

  const data = await getAttendanceData({ date });

  return (
    <Container id="admin-attendance" sectionStyle="" className="py-6">
      <AttendanceClient
        date={data.date}
        staffAttendance={data.staffAttendance}
        summary={data.summary}
      />
    </Container>
  );
}
