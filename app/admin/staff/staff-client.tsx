"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminSelect, ErrorBanner, AdminPageHeader, RoleBadge, StatusBadge, TableEmptyRow } from "@/components/admin/ui";
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

      {/* Staff table */}
      <Card>
        <CardContent className="pt-4">
          {staffList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada staff.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-foreground/10 text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Nama</th>
                    <th className="pb-2 font-medium">Role</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Akun Supabase</th>
                    <th className="pb-2 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((s) => (
                    <>
                      <tr key={s.id} className="border-b border-foreground/5">
                        <td className="py-2 font-medium">{s.name}</td>
                        <td className="py-2">
                          <RoleBadge role={s.role} />
                        </td>
                        <td className="py-2">
                          <StatusBadge
                            active={s.isActive}
                            onClick={() => run(() => toggleStaffActive(s.id, s.isActive))}
                            disabled={isPending}
                          />
                        </td>
                        <td className="py-2 text-muted-foreground text-xs">
                          {s.supabaseEmail ?? (
                            <span className="italic">Belum terhubung</span>
                          )}
                        </td>
                        <td className="py-2">
                          <div className="flex gap-1 flex-wrap">
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() =>
                                setEditId(editId === s.id ? null : s.id)
                              }
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
                                onClick={() =>
                                  run(() => unlinkSupabaseUser(s.id))
                                }
                                disabled={isPending}
                              >
                                Putuskan
                              </Button>
                            )}
                            <Button
                              size="xs"
                              variant="destructive"
                              onClick={() => {
                                if (
                                  confirm(
                                    `Hapus staff "${s.name}"? Aksi ini tidak bisa dibatalkan.`
                                  )
                                )
                                  run(() => deleteStaff(s.id));
                              }}
                              disabled={isPending}
                            >
                              Hapus
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {/* Edit inline */}
                      {editId === s.id && (
                        <tr key={`edit-${s.id}`} className="bg-muted/30">
                          <td colSpan={5} className="px-2 py-3">
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
                                <Label>Nama</Label>
                                <Input
                                  name="name"
                                  defaultValue={s.name}
                                  required
                                />
                              </div>
                              <div className="grid gap-1">
                                <Label>Role</Label>
                                <AdminSelect name="role" defaultValue={s.role}>
                                  {ROLES.map((r) => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </AdminSelect>
                              </div>
                              <Button
                                type="submit"
                                size="sm"
                                disabled={isPending}
                              >
                                Simpan
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditId(null)}
                              >
                                Batal
                              </Button>
                            </form>
                          </td>
                        </tr>
                      )}

                      {/* Link Supabase user inline */}
                      {linkId === s.id && (
                        <tr key={`link-${s.id}`} className="bg-muted/30">
                          <td colSpan={5} className="px-2 py-3">
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
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setLinkId(null)}
                              >
                                Batal
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
