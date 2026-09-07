import { AppShell } from "@/components/shell/app-shell";
import { requireCanStrict } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { IzinClient } from "./izin-client";

export const dynamic = "force-dynamic";

/**
 * /buku/izin — Owner-only permission screen (real OWNER only: the strict gate
 * admits no DEVELOPER, and the actions double-check the actor's real role).
 * Lives under /buku because it is bookkeeping of the shop's access, and that
 * is where the Owner already manages structure.
 */
export default async function BukuIzinPage() {
  const staff = await requireCanStrict("permissions.manage");
  const rows = await prisma.rolePermission.findMany();

  const overrides: Record<string, Record<string, boolean>> = {};
  for (const r of rows) {
    (overrides[r.role] ??= {})[r.capability] = r.allowed;
  }

  return (
    <AppShell role={staff.role}>
      <div className="px-4 pb-1 pt-5">
        <h1 className="font-display text-[17px] font-bold">Izin Peran</h1>
        <p className="text-[11.5px] font-semibold text-muted-foreground">
          Atur apa yang bisa dilakukan tiap peran
        </p>
      </div>
      <IzinClient overrides={overrides} />
    </AppShell>
  );
}
