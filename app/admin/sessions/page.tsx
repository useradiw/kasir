import { Container } from "@/components/shared/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleBadge, StatusBadge, TableEmptyRow } from "@/components/admin/ui";
import { getSessionsData } from "@/app/actions/admin/queries";
import { formatDateTime } from "@/lib/format";

const ACTIVE_THRESHOLD_MINUTES = 30;

export default async function SessionsPage() {
  const { users, error } = await getSessionsData();

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
    <Container id="admin-sessions" sectionStyle="" className="!max-w-4xl py-6 space-y-6">
      <h1 className="text-2xl font-bold">Sesi Login</h1>

      {error && (
        <div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          Gagal memuat data pengguna: {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pengguna Supabase ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            &ldquo;Aktif&rdquo; = login dalam {ACTIVE_THRESHOLD_MINUTES} menit terakhir.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-foreground/10 text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Staff</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium">Login Terakhir</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-foreground/5">
                    <td className="py-2 font-mono text-xs">{r.email}</td>
                    <td className="py-2">
                      {r.staffName ?? (
                        <span className="italic text-muted-foreground">Tidak terhubung</span>
                      )}
                    </td>
                    <td className="py-2">
                      {r.staffRole ? <RoleBadge role={r.staffRole} /> : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {r.lastSignIn ? formatDateTime(r.lastSignIn, "medium") : "—"}
                    </td>
                    <td className="py-2">
                      <StatusBadge active={r.isRecent} />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <TableEmptyRow colSpan={5} message="Tidak ada pengguna." />
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}
