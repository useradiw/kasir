import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { NotificationBellServer } from "@/components/shared/notification-bell-server";
import { getAttendanceData } from "@/app/actions/admin/queries";
import { requireRole } from "@/lib/admin-auth";
import AttendanceClient from "./attendance-client";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const staff = await requireRole("OWNER", "MANAGER");
  const params = await searchParams;
  const date = params.date ?? "";

  const data = await getAttendanceData({ date });

  return (
    <AppShell role={staff.role}>
      <div className="flex items-start justify-between px-4 pb-1 pt-6">
        <div>
          <Link href="/admin" className="text-[12.5px] font-bold text-muted-foreground">
            ← Admin
          </Link>
          <h1 className="font-display mt-2 text-[17px] font-bold">Absensi Staff</h1>
          <p className="text-[11.5px] font-semibold text-muted-foreground">{data.date}</p>
        </div>
        <NotificationBellServer staffId={staff.id} />
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        <AttendanceClient date={data.date} staffAttendance={data.staffAttendance} summary={data.summary} />
      </div>
    </AppShell>
  );
}
