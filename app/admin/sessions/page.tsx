import { Container } from "@/components/shared/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleBadge, StatusBadge } from "@/components/admin/ui";
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
    <Container id="admin-sessions" sectionStyle="" className="py-6 space-y-6">
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
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground mb-4">
            &ldquo;Aktif&rdquo; = login dalam {ACTIVE_THRESHOLD_MINUTES} menit terakhir.
          </p>

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Tidak ada pengguna.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="flex items-start justify-between rounded-lg border border-foreground/10 p-3 gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-mono text-xs truncate">{r.email}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm">
                        {r.staffName ?? (
                          <span className="italic text-muted-foreground text-xs">Tidak terhubung</span>
                        )}
                      </span>
                      {r.staffRole && <RoleBadge role={r.staffRole} />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Login: {r.lastSignIn ? formatDateTime(r.lastSignIn, "medium") : "—"}
                    </p>
                  </div>
                  <StatusBadge active={r.isRecent} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
