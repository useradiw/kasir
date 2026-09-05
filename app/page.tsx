import { LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "@/components/login-form";
import { signOut } from "@/app/actions/sign-out";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="dark min-h-dvh bg-background text-foreground">
        <div className="mx-auto w-full max-w-lg px-4">
          <LoginForm />
        </div>
      </div>
    );
  }

  // Authenticated users live in the tab-shell app now (docs/redesign/SPEC.md);
  // the old hub cards remain below only as a deep-link fallback.
  const staffRecord = await prisma.staff.findUnique({
    where: { supabaseUserId: user.id },
    select: { id: true, isActive: true },
  });
  if (staffRecord?.isActive) redirect("/beranda");

  // Active staff were redirected to /beranda above. What is left: a session
  // whose Staff record is missing or inactive — show a plain sign-out screen,
  // NOT the old hub (which used to render them a fake STAFF view).
  return (
    <div className="dark min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h1 className="font-display text-[17px] font-bold">Akun tidak aktif</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Akun ini sudah tidak aktif atau tidak terdaftar sebagai staff. Hubungi pemilik toko.
          </p>
          <form action={signOut} className="mt-4">
            <button
              type="submit"
              className="cursor-pointer flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card-2 text-[14px] font-bold transition-all duration-150 active:scale-[0.98]"
            >
              <LogOut className="size-4" />
              Keluar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
