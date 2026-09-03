"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { notify } from "@/lib/notify";
import { createClient } from "@/utils/supabase/client";
import { useAdminAction } from "@/hooks/use-admin-action";
import { updateProfileName } from "@/app/actions/profile";
import { signOut } from "@/app/actions/sign-out";
import { RoleBadge } from "@/components/admin/ui";
import { ErrorBanner } from "@/components/shared/ui";
import { BentoCard, CardLabel } from "@/components/shell/ui";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  name: string;
  username: string | null;
  role: string;
  email: string | null;
};

/** One labelled read-only fact inside the Informasi Akun card. */
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[12.5px] font-semibold text-muted-foreground">{label}</span>
      <div className="text-[13px] font-bold">{children}</div>
    </div>
  );
}

export function ProfileClient({ name, username, role, email }: Props) {
  const nameAction = useAdminAction();

  const [pwOld, setPwOld] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwPending, setPwPending] = useState(false);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);

    if (pwNew.length < 6) {
      setPwError("Password minimal 6 karakter");
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError("Password baru tidak cocok");
      return;
    }

    setPwPending(true);
    try {
      const supabase = createClient();

      // Verify old password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email!,
        password: pwOld,
      });
      if (signInError) {
        setPwError("Password lama salah");
        return;
      }

      // Set new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: pwNew,
      });
      if (updateError) {
        setPwError("Gagal mengubah password");
        return;
      }

      setPwOld("");
      setPwNew("");
      setPwConfirm("");
      notify.success("Password berhasil diubah");
    } finally {
      setPwPending(false);
    }
  }

  return (
    <>
      {/* Informasi Akun */}
      <BentoCard className="flex flex-col gap-0.5">
        <CardLabel>Informasi Akun</CardLabel>
        <div className="mt-1.5">
          <InfoRow label="Username">{username ?? "-"}</InfoRow>
          <InfoRow label="Role">
            <RoleBadge role={role} />
          </InfoRow>
          <InfoRow label="Email">
            <span className="break-all">{email ?? "-"}</span>
          </InfoRow>
        </div>
      </BentoCard>

      {/* Ubah Nama */}
      <BentoCard className="flex flex-col gap-0.5">
        <CardLabel>Ubah Nama</CardLabel>
        <form
          action={(fd) =>
            nameAction.run(() => updateProfileName(fd), { successMessage: "Nama berhasil diubah" })
          }
          className="mt-2 space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama</Label>
            <Input id="name" name="name" defaultValue={name} required />
          </div>
          <ErrorBanner error={nameAction.error} />
          <Button type="submit" disabled={nameAction.isPending} className="w-full">
            {nameAction.isPending ? (
              <>
                <Spinner /> Menyimpan...
              </>
            ) : (
              "Simpan"
            )}
          </Button>
        </form>
      </BentoCard>

      {/* Ubah Password */}
      {email && (
        <BentoCard className="flex flex-col gap-0.5">
          <CardLabel>Ubah Password</CardLabel>
          <form onSubmit={handlePasswordChange} className="mt-2 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pw-old">Password Lama</Label>
              <Input
                id="pw-old"
                type="password"
                value={pwOld}
                onChange={(e) => setPwOld(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-new">Password Baru</Label>
              <Input
                id="pw-new"
                type="password"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-confirm">Konfirmasi Password</Label>
              <Input
                id="pw-confirm"
                type="password"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                required
              />
            </div>
            <ErrorBanner error={pwError} />
            <Button type="submit" disabled={pwPending} className="w-full">
              {pwPending ? (
                <>
                  <Spinner /> Mengubah...
                </>
              ) : (
                "Ubah Password"
              )}
            </Button>
          </form>
        </BentoCard>
      )}

      {/* Keluar — also on /akun as a one-tap row from the tab bar. */}
      <form action={signOut}>
        <Button
          type="submit"
          variant="outline"
          className="w-full gap-1.5 border-destructive/30 bg-destructive/10 text-destructive"
        >
          <LogOut className="size-4" />
          Keluar
        </Button>
      </form>
    </>
  );
}
