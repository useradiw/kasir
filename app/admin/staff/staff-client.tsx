"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminSelect, ErrorBanner, AdminPageHeader, RoleBadge, StatusBadge } from "@/components/admin/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import {
  addStaff,
  updateStaff,
  deleteStaff,
  toggleStaffActive,
  linkSupabaseUser,
  unlinkSupabaseUser,
} from "@/app/actions/admin/staff";

type StaffRow = {
  id: string;
  username: string | null;
  name: string;
  role: "OWNER" | "MANAGER" | "CASHIER" | "STAFF";
  isActive: boolean;
  supabaseUserId: string | null;
  supabaseEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

const ROLES = ["OWNER", "MANAGER", "CASHIER", "STAFF"] as const;

export default function StaffClient({ staffList }: { staffList: StaffRow[] }) {
  const { isPending, run, error } = useAdminAction();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [linkId, setLinkId] = useState<string | null>(null);
  const [linkEmail, setLinkEmail] = useState("");

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Manajemen Staff">
        <Button onClick={() => setShowAdd((v) => !v)} size="sm">
          {showAdd ? "Batal" : "+ Tambah Staff"}
        </Button>
      </AdminPageHeader>

      <ErrorBanner error={error} />

      {/* Add form */}
      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle>Tambah Staff Baru</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={(fd) =>
                run(async () => {
                  await addStaff(fd);
                  setShowAdd(false);
                })
              }
              className="flex flex-wrap gap-3 items-end"
            >
              <div className="grid gap-1">
                <Label htmlFor="add-username">Username</Label>
                <Input id="add-username" name="username" required placeholder="username" />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="add-name">Nama</Label>
                <Input id="add-name" name="name" required placeholder="Nama staff" />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="add-role">Role</Label>
                <AdminSelect id="add-role" name="role" required>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </AdminSelect>
              </div>
              <Button type="submit" disabled={isPending} size="sm">
                Simpan
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Staff list */}
      <Card>
        <CardContent className="pt-4">
          {staffList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada staff.</p>
          ) : (
            <div className="space-y-3">
              {staffList.map((s) => (
                <div key={s.id} className="rounded-lg border border-foreground/10 p-3 space-y-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.username ? `@${s.username}` : <span className="italic">Belum ada username</span>} · {s.supabaseEmail ?? <span className="italic">Belum terhubung</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      <RoleBadge role={s.role} />
                      <StatusBadge
                        active={s.isActive}
                        onClick={() => run(() => toggleStaffActive(s.id, s.isActive))}
                        disabled={isPending}
                      />
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-1 flex-wrap">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setEditId(editId === s.id ? null : s.id)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="xs"
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
                        size="xs"
                        variant="ghost"
                        onClick={() => run(() => unlinkSupabaseUser(s.id))}
                        disabled={isPending}
                      >
                        Putuskan
                      </Button>
                    )}
                    <Button
                      size="xs"
                      variant="destructive"
                      onClick={() => {
                        if (confirm(`Hapus staff "${s.name}"? Aksi ini tidak bisa dibatalkan.`))
                          run(() => deleteStaff(s.id));
                      }}
                      disabled={isPending}
                    >
                      Hapus
                    </Button>
                  </div>

                  {/* Inline edit form */}
                  {editId === s.id && (
                    <div className="border-t border-foreground/10 pt-3">
                      <form
                        action={(fd) =>
                          run(async () => {
                            await updateStaff(s.id, fd);
                            setEditId(null);
                          })
                        }
                        className="flex flex-wrap gap-3 items-end"
                      >
                        <div className="grid gap-1">
                          <Label>Username</Label>
                          <Input name="username" defaultValue={s.username ?? ""} required />
                        </div>
                        <div className="grid gap-1">
                          <Label>Nama</Label>
                          <Input name="name" defaultValue={s.name} required />
                        </div>
                        <div className="grid gap-1">
                          <Label>Role</Label>
                          <AdminSelect name="role" defaultValue={s.role}>
                            {ROLES.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </AdminSelect>
                        </div>
                        <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(null)}>Batal</Button>
                      </form>
                    </div>
                  )}

                  {/* Inline link Supabase form */}
                  {linkId === s.id && (
                    <div className="border-t border-foreground/10 pt-3">
                      <div className="flex flex-wrap gap-3 items-end">
                        <div className="grid gap-1">
                          <Label>Email Supabase</Label>
                          <Input
                            type="email"
                            placeholder="email@contoh.com"
                            value={linkEmail}
                            onChange={(e) => setLinkEmail(e.target.value)}
                          />
                        </div>
                        <Button
                          size="sm"
                          disabled={isPending || !linkEmail}
                          onClick={() =>
                            run(async () => {
                              await linkSupabaseUser(s.id, linkEmail);
                              setLinkId(null);
                            })
                          }
                        >
                          Hubungkan
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setLinkId(null)}>Batal</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
