import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { NotificationBellServer } from "@/components/shared/notification-bell-server";
import { getReportData } from "@/app/actions/admin/queries";
import { requireRole } from "@/lib/admin-auth";
import { ReportClient } from "./report-client";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; date?: string }>;
}) {
  const staff = await requireRole("OWNER", "MANAGER");
  const isOwner = staff.role === "OWNER" || staff.role === "DEVELOPER";
  const params = await searchParams;
  const period = (["daily", "weekly", "monthly", "yearly"].includes(params.period ?? "")
    ? params.period
    : "daily") as "daily" | "weekly" | "monthly" | "yearly";

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const date = params.date || todayStr;

  const data = await getReportData({ period, date, isOwner });

  return (
    <AppShell role={staff.role}>
      <div className="flex items-start justify-between px-4 pb-1 pt-6">
        <div>
          <Link href="/admin" className="cursor-pointer text-[12.5px] font-bold text-muted-foreground">
            ← Admin
          </Link>
          <h1 className="font-display mt-2 text-[17px] font-bold">Laporan</h1>
          <p className="text-[11.5px] font-semibold text-muted-foreground">
            Ringkasan penjualan dan operasional
          </p>
        </div>
        <NotificationBellServer staffId={staff.id} />
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        <ReportClient data={data} currentPeriod={period} currentDate={date} isOwner={isOwner} />
      </div>
    </AppShell>
  );
}
