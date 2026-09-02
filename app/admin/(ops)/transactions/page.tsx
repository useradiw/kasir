import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { NotificationBellServer } from "@/components/shared/notification-bell-server";
import { getTransactionsData } from "@/app/actions/admin/queries";
import { requireRole } from "@/lib/admin-auth";
import TransactionsClient from "./transactions-client";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    method?: string;
    status?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const staff = await requireRole("OWNER", "MANAGER");
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const method = params.method ?? "";
  const status = params.status ?? "";
  const from = params.from ?? "";
  const to = params.to ?? "";

  const data = await getTransactionsData({ page, method, status, from, to });

  return (
    <AppShell role={staff.role}>
      <div className="flex items-start justify-between px-4 pb-1 pt-6">
        <div>
          <Link href="/admin" className="text-[12.5px] font-bold text-muted-foreground">
            ← Admin
          </Link>
          <h1 className="font-display mt-2 text-[17px] font-bold">Transaksi</h1>
          <p className="text-[11.5px] font-semibold text-muted-foreground">
            {data.total} transaksi total
          </p>
        </div>
        <NotificationBellServer staffId={staff.id} />
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        <TransactionsClient
          rows={data.rows}
          page={page}
          totalPages={data.totalPages}
          total={data.total}
          filters={{ method, status, from, to }}
          isOwner={staff.role === "OWNER" || staff.role === "DEVELOPER"}
        />
      </div>
    </AppShell>
  );
}
