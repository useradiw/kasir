"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { useAdminAction } from "@/hooks/use-admin-action";
import { updateProfileName } from "@/app/actions/profile";
import { signOut } from "@/app/actions/sign-out";
import { RoleBadge } from "@/components/admin/ui";
import { ErrorBanner, PageHeader } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  name: string;
  username: string | null;
  role: string;
  email: string | null;
};

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
      toast.success("Password berhasil diubah");
    } finally {
      setPwPending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-5" />
          </Link>
          <PageHeader title="Profil Saya" />
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm" className="cursor-pointer gap-1.5">
            <LogOut className="size-4" />
            Keluar
          </Button>
        </form>
      </div>

      {/* Card A — Informasi Akun */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informasi Akun</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-muted-foreground text-xs">Username</Label>
            <p className="text-sm font-medium">{username ?? "-"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Role</Label>
            <div className="mt-0.5">
              <RoleBadge role={role} />
            </div>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Email</Label>
            <p className="text-sm font-medium">{email ?? "-"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Card B — Ubah Nama */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ubah Nama</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={(fd) => nameAction.run(() => updateProfileName(fd), { successMessage: "Nama berhasil diubah" })}
            className="space-y-3"
          >
            <div>
              <Label htmlFor="name">Nama</Label>
              <Input id="name" name="name" defaultValue={name} required />
            </div>
            <ErrorBanner error={nameAction.error} />
            <Button type="submit" disabled={nameAction.isPending} className="cursor-pointer">
              {nameAction.isPending ? <><Spinner /> Menyimpan...</> : "Simpan"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Card C — Ubah Password */}
      {email && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ubah Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-3">
              <div>
                <Label htmlFor="pw-old">Password Lama</Label>
                <Input
                  id="pw-old"
                  type="password"
                  value={pwOld}
                  onChange={(e) => setPwOld(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="pw-new">Password Baru</Label>
                <Input
                  id="pw-new"
                  type="password"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  required
                />
              </div>
              <div>
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
              <Button type="submit" disabled={pwPending} className="cursor-pointer">
                {pwPending ? <><Spinner /> Mengubah...</> : "Ubah Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
