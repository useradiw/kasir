import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { NotificationBellServer } from "@/components/shared/notification-bell-server";
import { requireRole } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import SuppliersClient from "./suppliers-client";

export default async function SuppliersPage() {
  const staff = await requireRole("OWNER", "MANAGER");

  const suppliers = await prisma.supplier.findMany({
    where:   { isActive: true },
    orderBy: { name: "asc" },
    select:  { id: true, name: true, phone: true, notes: true, createdAt: true },
  });

  return (
    <AppShell role={staff.role}>
      <div className="flex items-start justify-between px-4 pb-1 pt-6">
        <div>
          <Link href="/admin" className="cursor-pointer text-[12.5px] font-bold text-muted-foreground">
            ← Admin
          </Link>
          <h1 className="font-display mt-2 text-[17px] font-bold">Supplier</h1>
          <p className="text-[11.5px] font-semibold text-muted-foreground">
            {suppliers.length} supplier aktif
          </p>
        </div>
        <NotificationBellServer staffId={staff.id} />
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        <SuppliersClient suppliers={suppliers} />
      </div>
    </AppShell>
  );
}
