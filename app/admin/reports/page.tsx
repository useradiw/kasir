import { Container } from "@/components/shared/container";
import { getReportData } from "@/app/actions/admin/queries";
import { ReportClient } from "./report-client";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; date?: string }>;
}) {
  const params = await searchParams;
  const period = (["daily", "weekly", "monthly"].includes(params.period ?? "")
    ? params.period
    : "daily") as "daily" | "weekly" | "monthly";

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const date = params.date || todayStr;

  const data = await getReportData({ period, date });

  return (
    <Container id="admin-reports" sectionStyle="" className="py-6">
      <ReportClient data={data} currentPeriod={period} currentDate={date} />
    </Container>
  );
}
