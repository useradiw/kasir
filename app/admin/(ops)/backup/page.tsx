import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { NotificationBellServer } from "@/components/shared/notification-bell-server";
import { requireCan } from "@/lib/admin-auth";
import BackupTabsClient from "./backup-tabs-client";

export default async function BackupPage() {
  const staff = await requireCan("backup.export");

  return (
    <AppShell role={staff.role}>
      <div className="flex items-start justify-between px-4 pb-1 pt-6">
        <div>
          <Link href="/admin" className="cursor-pointer text-[12.5px] font-bold text-muted-foreground">
            ← Admin
          </Link>
          <h1 className="font-display mt-2 text-[17px] font-bold">Backup Database</h1>
          <p className="text-[11.5px] font-semibold text-muted-foreground">
            Export dan pulihkan data
          </p>
        </div>
        <NotificationBellServer staffId={staff.id} />
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        <BackupTabsClient />
      </div>
    </AppShell>
  );
}
