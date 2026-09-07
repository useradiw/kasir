import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { requireCanStrict } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { IzinClient } from "./izin-client";

export const dynamic = "force-dynamic";

/**
 * /admin/izin — the Owner's permission screen.
 *
 * REAL OWNER ONLY, and that is enforced three times over. The gate here is
 * requireCanStrict("permissions.manage"): strict removes the DEVELOPER
 * superuser bypass, and permissions.manage is granted to nobody in
 * DEFAULT_GRID, so no other role can reach it. Every write in actions.ts then
 * re-checks the actor's real role, so even if the capability were somehow
 * granted away the writes would still refuse. test/permissions-matrix.test.ts
 * pins the strict shape.
 *
 * It sits under /admin, next to /admin/staff, because that is where roles are
 * ASSIGNED — whoever just changed someone from Cashier to Manager is the
 * person who then wants to know what Manager can do. It was briefly under
 * /buku (moved 2026-09-07 at Adi's direction); access control is not
 * bookkeeping, and nothing had shipped, so it was moved before anyone saw it.
 *
 * The (ops) layout gates on admin.ops, which MANAGER also passes — that is
 * defense in depth for the section, not this page's gate. The strict check
 * above is what makes this page Owner-only.
 */
export default async function BukuIzinPage() {
  const staff = await requireCanStrict("permissions.manage");
  // Same deploy-order guard as lib/permission-store.ts: between deploying this
  // code and applying the DDL by hand the table does not exist. Every gate
  // already degrades to the default grid in that window, so this screen shows
  // the defaults too rather than crashing on the only page that reads the
  // table directly.
  const rows = await prisma.rolePermission.findMany().catch((e: unknown) => {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2021") {
      return [];
    }
    throw e;
  });

  const overrides: Record<string, Record<string, boolean>> = {};
  for (const r of rows) {
    (overrides[r.role] ??= {})[r.capability] = r.allowed;
  }

  return (
    <AppShell role={staff.role}>
      <div className="px-4 pb-1 pt-5">
        <Link href="/admin" className="cursor-pointer text-[12.5px] font-bold text-muted-foreground">
          ← Admin
        </Link>
        <h1 className="font-display mt-2 text-[17px] font-bold">Izin Peran</h1>
        <p className="text-[11.5px] font-semibold text-muted-foreground">
          Atur apa yang bisa dilakukan tiap peran
        </p>
      </div>
      <IzinClient overrides={overrides} />
    </AppShell>
  );
}
