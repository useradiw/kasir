"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminSelect } from "@/components/admin/ui";
import { RoleBadge } from "@/components/shared/badge";
import { BentoCard, Tag } from "@/components/shell/ui";
import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";
import { useAdminAction } from "@/hooks/use-admin-action";
import { useConfirm } from "@/components/shared/confirm-dialog";
import {
  addStaff,
  updateStaff,
  deleteStaff,
  toggleStaffActive,
  linkSupabaseUser,
  unlinkSupabaseUser,
} from "@/app/actions/admin/staff";
import { Copy, Check } from "lucide-react";

type StaffRow = {
  id: string;
  username: string | null;
  name: string;
  role: "OWNER" | "MANAGER" | "CASHIER" | "STAFF" | "DEVELOPER";
  isActive: boolean;
  salary: number | null;
  supabaseUserId: string | null;
  supabaseEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

const ROLES = ["OWNER", "MANAGER", "CASHIER", "STAFF", "DEVELOPER"] as const;

export default function StaffClient({ staffList, isOwner }: { staffList: StaffRow[]; isOwner: boolean }) {
  const { isPending, run, error, setError } = useAdminAction();
  const confirm = useConfirm();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [linkId, setLinkId] = useState<string | null>(null);
  const [linkEmail, setLinkEmail] = useState("");
  const [copied, setCopied] = useState(false);

  const copyRegisterLink = useCallback(() => {
    const url = `${window.location.origin}/auth/daftar`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <>
      {isOwner && (
        <div className="flex justify-end gap-2">
          <Button onClick={copyRegisterLink} size="sm" variant="outline" className="gap-1.5">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Tersalin!" : "Link Daftar"}
          </Button>
          <Button
            onClick={() => {
              setShowAdd((v) => !v);
              setError(null);
            }}
            size="sm"
          >
            {showAdd ? "Batal" : "+ Tambah Staff"}
          </Button>
        </div>
      )}

      {error ? (
        <div className="rounded-2xl border border-destructive/35 bg-destructive-soft p-3.5 text-[12.5px] font-semibold text-destructive">
          {error}
        </div>
      ) : null}

      {showAdd && (
        <BentoCard>
          <form
            action={(fd) =>
              run(
                async () => {
                  await addStaff(fd);
                  setShowAdd(false);
                },
                { successMessage: "Staff ditambahkan" },
              )
            }
            className="flex flex-col gap-3"
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1">
                <Label htmlFor="add-username">Username</Label>
                <Input id="add-username" name="username" required placeholder="username" className="w-36 border-border bg-card-2" />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="add-name">Nama</Label>
                <Input id="add-name" name="name" required placeholder="Nama staff" className="w-40 border-border bg-card-2" />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="add-role">Role</Label>
                <AdminSelect id="add-role" name="role" required className="border-border bg-card-2">
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </AdminSelect>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="add-salary">Gaji (Rp)</Label>
                <Input id="add-salary" name="salary" type="number" min={0} placeholder="0" className="w-32 border-border bg-card-2" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Batal</Button>
            </div>
          </form>
        </BentoCard>
      )}

      {staffList.length === 0 ? (
        <p className="py-6 text-center text-[12.5px] font-semibold text-muted-foreground">
          Belum ada staff.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {staffList.map((s) =>
            editId === s.id ? (
              <BentoCard key={s.id}>
                <form
                  action={(fd) =>
                    run(
                      async () => {
                        await updateStaff(s.id, fd);
                        setEditId(null);
                      },
                      { successMessage: "Staff diperbarui" },
                    )
                  }
                  className="flex flex-col gap-3"
                >
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="grid gap-1">
                      <Label>Username</Label>
                      <Input name="username" defaultValue={s.username ?? ""} required className="w-36 border-border bg-card-2" />
                    </div>
                    <div className="grid gap-1">
                      <Label>Nama</Label>
                      <Input name="name" defaultValue={s.name} required className="w-40 border-border bg-card-2" />
                    </div>
                    <div className="grid gap-1">
                      <Label>Role</Label>
                      <AdminSelect name="role" defaultValue={s.role} className="border-border bg-card-2">
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </AdminSelect>
                    </div>
                    <div className="grid gap-1">
                      <Label>Gaji (Rp)</Label>
                      <Input name="salary" type="number" min={0} defaultValue={s.salary ?? ""} className="w-32 border-border bg-card-2" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(null)}>Batal</Button>
                  </div>
                </form>
              </BentoCard>
            ) : (
              <BentoCard key={s.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold leading-snug">{s.name}</p>
                    <p className="mt-0.5 text-[11.5px] font-semibold leading-snug text-muted-foreground">
                      {s.username ? `@${s.username}` : <span className="italic">Belum ada username</span>}
                      {" · "}
                      {s.supabaseEmail ?? <span className="italic">Belum terhubung</span>}
                      {isOwner && s.salary != null && (
                        <>
                          {" · Gaji: "}
                          <span className="tabular-nums">{formatRupiah(s.salary)}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    <RoleBadge role={s.role} />
                    {isOwner ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className={cn(
                          "h-auto rounded-full px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wide",
                          s.isActive ? "bg-success-soft text-success hover:bg-success-soft" : "bg-card-2 text-muted-foreground border border-border",
                        )}
                        disabled={isPending}
                        onClick={() => run(() => toggleStaffActive(s.id, s.isActive))}
                      >
                        {s.isActive ? "Aktif" : "Nonaktif"}
                      </Button>
                    ) : (
                      <Tag tone={s.isActive ? "ok" : "mut"}>{s.isActive ? "Aktif" : "Nonaktif"}</Tag>
                    )}
                  </div>
                </div>

                {isOwner && (
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setEditId(editId === s.id ? null : s.id)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setLinkId(linkId === s.id ? null : s.id);
                        setLinkEmail("");
                      }}
                    >
                      {s.supabaseEmail ? "Ganti Akun" : "Hubungkan"}
                    </Button>
                    {s.supabaseEmail && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() => run(() => unlinkSupabaseUser(s.id), { successMessage: "Akun diputuskan" })}
                      >
                        Putuskan
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={isPending}
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Hapus staff "${s.name}"?`,
                          description: "Aksi ini tidak bisa dibatalkan.",
                          destructive: true,
                          confirmLabel: "Hapus",
                        });
                        if (ok) run(() => deleteStaff(s.id), { successMessage: "Staff dihapus" });
                      }}
                    >
                      Hapus
                    </Button>
                  </div>
                )}

                {linkId === s.id && (
                  <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
                    <div className="grid min-w-40 flex-1 gap-1">
                      <Label>Email Supabase</Label>
                      <Input
                        type="email"
                        placeholder="email@contoh.com"
                        value={linkEmail}
                        onChange={(e) => setLinkEmail(e.target.value)}
                        className="border-border bg-card-2"
                      />
                    </div>
                    <Button
                      size="sm"
                      disabled={isPending || !linkEmail}
                      onClick={() =>
                        run(
                          async () => {
                            await linkSupabaseUser(s.id, linkEmail);
                            setLinkId(null);
                          },
                          { successMessage: "Akun terhubung" },
                        )
                      }
                    >
                      Hubungkan
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setLinkId(null)}>Batal</Button>
                  </div>
                )}
              </BentoCard>
            ),
          )}
        </div>
      )}
    </>
  );
}
