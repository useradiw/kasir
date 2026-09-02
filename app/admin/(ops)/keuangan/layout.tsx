import { Container } from "@/components/shared/container";
import { AdminPageHeader } from "@/components/admin/ui";
import { requireOwner } from "@/lib/admin-auth";
import { listMonths } from "@/app/actions/admin/queries";
import { getSelectedMonth } from "@/lib/keuangan-month";
import { KeuanganTabs } from "./_components/keuangan-tabs";
import { MonthPicker } from "./_components/month-picker";

export default async function KeuanganLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  const [months, selected] = await Promise.all([listMonths(), getSelectedMonth()]);

  return (
    <Container id="admin-keuangan" sectionStyle="" className="py-6">
      <div className="space-y-4">
        <AdminPageHeader title="Keuangan">
          <MonthPicker months={months} selected={selected} />
        </AdminPageHeader>
        <KeuanganTabs />
        {children}
      </div>
    </Container>
  );
}
