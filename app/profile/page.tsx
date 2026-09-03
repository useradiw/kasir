import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { requireAuth } from "@/lib/admin-auth";
import { AppShell } from "@/components/shell/app-shell";
import { ProfileClient } from "./profile-client";

export default async function ProfilePage() {
  const staff = await requireAuth();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AppShell role={staff.role}>
      <div className="px-4 pb-1 pt-6">
        <Link href="/akun" className="text-[12.5px] font-bold text-muted-foreground">
          ← Akun
        </Link>
        <h1 className="font-display mt-2 text-[17px] font-bold">Profil Saya</h1>
        <p className="text-[11.5px] font-semibold text-muted-foreground">
          {staff.name} · {staff.role}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        <ProfileClient
          name={staff.name}
          username={staff.username}
          role={staff.role}
          email={user?.email ?? null}
        />
      </div>
    </AppShell>
  );
}
