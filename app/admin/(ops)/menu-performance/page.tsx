import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { NotificationBellServer } from "@/components/shared/notification-bell-server";
import { requireCan } from "@/lib/admin-auth";
import { getMenuPerformanceData } from "@/app/actions/admin/queries";
import { MenuPerformanceClient } from "./menu-performance-client";

export default async function MenuPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; date?: string }>;
}) {
  const staff = await requireCan("menu.performance");
  const params = await searchParams;

  const period = (["daily", "weekly", "monthly", "yearly"].includes(params.period ?? "")
    ? params.period
    : "monthly") as "daily" | "weekly" | "monthly" | "yearly";

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const date = params.date || todayStr;

  const data = await getMenuPerformanceData({ period, date });

  return (
    <AppShell role={staff.role}>
      <div className="flex items-start justify-between px-4 pb-1 pt-6">
        <div>
          <Link href="/admin" className="cursor-pointer text-[12.5px] font-bold text-muted-foreground">
            ← Admin
          </Link>
          <h1 className="font-display mt-2 text-[17px] font-bold">Performa Menu</h1>
          <p className="text-[11.5px] font-semibold text-muted-foreground">
            Jumlah terjual dan pendapatan per menu item
          </p>
        </div>
        <NotificationBellServer staffId={staff.id} />
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        <MenuPerformanceClient data={data} currentPeriod={period} currentDate={date} />
      </div>
    </AppShell>
  );
}
