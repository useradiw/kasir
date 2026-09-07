import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { Row, Tag } from "@/components/shell/ui";
import { RoleBadge } from "@/components/shared/badge";
import { NotificationBellServer } from "@/components/shared/notification-bell-server";
import { getSessionsData } from "@/app/actions/admin/queries";
import { requireCan } from "@/lib/admin-auth";
import { formatDateTime } from "@/lib/format";

const ACTIVE_THRESHOLD_MINUTES = 30;

export default async function SessionsPage() {
  const staff = await requireCan("staff.read");
  const { users, error } = await getSessionsData();

  // Server component renders once per request — Date.now() is intentional.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const threshold = ACTIVE_THRESHOLD_MINUTES * 60 * 1000;

  const rows = users
    .map((u) => ({
      ...u,
      isRecent: u.lastSignIn ? now - new Date(u.lastSignIn).getTime() < threshold : false,
    }))
    .sort((a, b) => {
      if (a.isRecent !== b.isRecent) return a.isRecent ? -1 : 1;
      if (!a.lastSignIn && !b.lastSignIn) return 0;
      if (!a.lastSignIn) return 1;
      if (!b.lastSignIn) return -1;
      return new Date(b.lastSignIn).getTime() - new Date(a.lastSignIn).getTime();
    });

  return (
    <AppShell role={staff.role}>
      <div className="flex items-start justify-between px-4 pb-1 pt-6">
        <div>
          <Link href="/admin" className="cursor-pointer text-[12.5px] font-bold text-muted-foreground">
            ← Admin
          </Link>
          <h1 className="font-display mt-2 text-[17px] font-bold">Sesi Login</h1>
          <p className="text-[11.5px] font-semibold text-muted-foreground">
            {rows.length} pengguna Supabase · aktif = login {ACTIVE_THRESHOLD_MINUTES} menit terakhir
          </p>
        </div>
        <NotificationBellServer staffId={staff.id} />
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        {error ? (
          <div className="rounded-2xl border border-destructive/35 bg-destructive-soft p-3.5 text-[12.5px] font-semibold text-destructive">
            Gagal memuat data pengguna: {error}
          </div>
        ) : null}

        {rows.length === 0 ? (
          <p className="py-6 text-center text-[12.5px] font-semibold text-muted-foreground">
            Tidak ada pengguna.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {rows.map((r) => (
              <Row
                key={r.id}
                title={r.staffName ?? <span className="italic text-muted-foreground">Tidak terhubung</span>}
                meta={
                  <>
                    <span className="font-mono">{r.email}</span>
                    <br />
                    Login: {r.lastSignIn ? formatDateTime(r.lastSignIn, "medium") : "—"}
                  </>
                }
              >
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {r.staffRole ? <RoleBadge role={r.staffRole} /> : null}
                  <Tag tone={r.isRecent ? "ok" : "mut"}>{r.isRecent ? "Aktif" : "Tidak aktif"}</Tag>
                </div>
              </Row>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
