import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { NotificationBellServer } from "@/components/shared/notification-bell-server";
import { requireCan } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import SuppliersClient from "./suppliers-client";

/**
 * /admin/suppliers is INTENTIONALLY UNWIRED — do not delete it as dead code.
 *
 * Nothing reads supplier data today: it was the counterparty on the dormant
 * IngredientPurchase, and the COGS system that used it is retired. Adi decided
 * on 2026-09-01 to KEEP the screen because it is the starting point for the
 * purchasing work planned after the first deploy. It sits under Menu in the
 * admin index rather than Keuangan, because it no longer touches the ledger.
 *
 * This comment exists so the next audit stops re-flagging it, as required by
 * docs/redesign/plan-open-items.md section 5.
 */
export default async function SuppliersPage() {
  const staff = await requireCan("suppliers.write");

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
