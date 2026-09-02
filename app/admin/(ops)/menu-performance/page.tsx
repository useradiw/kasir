import { Container } from "@/components/shared/container";
import { requireOwner } from "@/lib/admin-auth";
import { getMenuPerformanceData } from "@/app/actions/admin/queries";
import { MenuPerformanceClient } from "./menu-performance-client";

export default async function MenuPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; date?: string }>;
}) {
  await requireOwner();
  const params = await searchParams;

  const period = (["daily", "weekly", "monthly", "yearly"].includes(params.period ?? "")
    ? params.period
    : "monthly") as "daily" | "weekly" | "monthly" | "yearly";

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const date = params.date || todayStr;

  const data = await getMenuPerformanceData({ period, date });

  return (
    <Container id="admin-menu-performance" sectionStyle="" className="py-6">
      <MenuPerformanceClient data={data} currentPeriod={period} currentDate={date} />
    </Container>
  );
}
