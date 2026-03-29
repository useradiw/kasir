import { Container } from "@/components/shared/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "@/app/actions/admin/queries";
import { formatRupiah, formatDateTime } from "@/lib/format";

export default async function AdminDashboard() {
  const data = await getDashboardData();

  const stats = [
    { label: "Pendapatan Hari Ini", value: formatRupiah(data.todayRevenue) },
    { label: "Transaksi Hari Ini", value: data.todayCount.toString() },
    { label: "Staff Aktif", value: data.activeStaff.toString() },
    { label: "Menu Tersedia", value: data.menuItems.toString() },
  ];

  return (
    <Container id="admin-dashboard" sectionStyle="" className="py-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground font-normal">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaksi Terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada transaksi.</p>
          ) : (
            <div className="divide-y divide-foreground/5">
            {data.recentTransactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{t.sessionName}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {t.paymentMethod.replace(/_/g, " ")} · {formatDateTime(t.paidAt)}
                  </p>
                </div>
                <span className="text-sm font-medium ml-3 shrink-0">{formatRupiah(t.totalAmount)}</span>
              </div>
            ))}
          </div>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
