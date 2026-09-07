import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { requireCan } from "@/lib/admin-auth";
import { getSettlementData } from "@/app/actions/admin/queries";
import { SettlementClient } from "./settlement-client";

export default async function SettlementPage() {
  const staff = await requireCan("settlement.use");
  const data = await getSettlementData();

  return (
    <AppShell role={staff.role}>
      <div className="px-4 pb-1 pt-6">
        <Link href="/admin" className="cursor-pointer text-[12.5px] font-bold text-muted-foreground">
          ← Admin
        </Link>
        <h1 className="font-display mt-2 text-[17px] font-bold">Pencairan Online</h1>
        <p className="text-[11.5px] font-semibold text-muted-foreground">
          {data.summary.unsettledCount} transaksi belum cair
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        <SettlementClient data={data} staffRole={staff.role} />
      </div>
    </AppShell>
  );
}
