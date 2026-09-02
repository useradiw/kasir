import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { NotificationBellServer } from "@/components/shared/notification-bell-server";
import { getStaffWithEmails } from "@/app/actions/admin/queries";
import { requireRole } from "@/lib/admin-auth";
import StaffClient from "./staff-client";

export default async function StaffPage() {
  const staff = await requireRole("OWNER", "MANAGER");
  const staffList = await getStaffWithEmails();
  const activeCount = staffList.filter((s) => s.isActive).length;

  return (
    <AppShell role={staff.role}>
      <div className="flex items-start justify-between px-4 pb-1 pt-6">
        <div>
          <Link href="/admin" className="text-[12.5px] font-bold text-muted-foreground">
            ← Admin
          </Link>
          <h1 className="font-display mt-2 text-[17px] font-bold">Staff</h1>
          <p className="text-[11.5px] font-semibold text-muted-foreground">
            {activeCount} orang aktif
          </p>
        </div>
        <NotificationBellServer staffId={staff.id} />
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        <StaffClient staffList={staffList} isOwner={staff.role === "OWNER" || staff.role === "DEVELOPER"} />
      </div>
    </AppShell>
  );
}
