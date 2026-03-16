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
    <Container id="admin-dashboard" sectionStyle="" className="!max-w-4xl py-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-foreground/10 text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Sesi</th>
                  <th className="pb-2 font-medium">Total</th>
                  <th className="pb-2 font-medium">Metode</th>
                  <th className="pb-2 font-medium">Waktu</th>
                </tr>
              </thead>
              <tbody>
                {data.recentTransactions.map((t) => (
                  <tr key={t.id} className="border-b border-foreground/5">
                    <td className="py-2">{t.sessionName}</td>
                    <td className="py-2">{formatRupiah(t.totalAmount)}</td>
                    <td className="py-2 capitalize">
                      {t.paymentMethod.replace(/_/g, " ")}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {formatDateTime(t.paidAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
