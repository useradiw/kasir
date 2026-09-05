"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminSelect } from "@/components/admin/ui";
import { BentoCard, CardLabel, Row, Tag } from "@/components/shell/ui";
import { useAdminAction } from "@/hooks/use-admin-action";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { formatDateTime } from "@/lib/format";
import {
  createTestNotification,
  deleteNotification,
  markAllNotificationsReadGlobal,
  triggerSampleVoidNotification,
} from "@/app/actions/admin/notifications";

type Row = {
  id: string;
  type: string;
  title: string;
  body: string;
  metadata: unknown;
  readAt: string | null;
  createdAt: string;
  recipientName: string;
  recipientRole: string;
};

const DEBUG_KEYS = [
  "error",
  "errorMessage",
  "message",
  "serverMessage",
  "stack",
  "cause",
  "originalError",
] as const;

function getDebugEntries(metadata: unknown): Array<[string, string]> {
  if (!metadata || typeof metadata !== "object") return [];
  const m = metadata as Record<string, unknown>;
  const entries: Array<[string, string]> = [];
  for (const k of DEBUG_KEYS) {
    if (k in m && m[k] != null) {
      const v = m[k];
      entries.push([k, typeof v === "string" ? v : JSON.stringify(v, null, 2)]);
    }
  }
  return entries;
}

type StaffOption = { id: string; name: string; role: string };

const TYPES = ["TRANSACTION_VOIDED", "SESSION_VOIDED", "TEST"] as const;

function typeTone(type: string): "bad" | "mut" {
  return type === "TEST" ? "mut" : "bad";
}

export default function NotificationsClient({
  notifications,
  staffList,
  filters,
}: {
  notifications: Row[];
  staffList: StaffOption[];
  filters: { type: string; read: string; recipient: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isPending, run, error } = useAdminAction();
  const confirm = useConfirm();
  const [showTest, setShowTest] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);

  const setParam = (key: string, value: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (value === "ALL" || !value) sp.delete(key);
    else sp.set(key, value);
    router.push(`/admin/notifications${sp.size ? `?${sp.toString()}` : ""}`);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Hapus notifikasi?",
      description: "Notifikasi ini akan dihapus secara permanen.",
      destructive: true,
      confirmLabel: "Hapus",
    });
    if (!ok) return;
    run(() => deleteNotification(id), { successMessage: "Notifikasi dihapus." });
    setSelected((curr) => (curr?.id === id ? null : curr));
  };

  return (
    <>
      <div className="flex flex-wrap justify-end gap-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            run(() => markAllNotificationsReadGlobal(), {
              successMessage: "Semua notifikasi ditandai dibaca.",
            })
          }
          disabled={isPending}
        >
          Tandai semua dibaca
        </Button>
        <Button size="sm" onClick={() => setShowTest((v) => !v)}>
          {showTest ? "Tutup uji" : "+ Uji notifikasi"}
        </Button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/35 bg-destructive-soft p-3.5 text-[12.5px] font-semibold text-destructive">
          {error}
        </div>
      ) : null}

      {showTest && (
        <BentoCard>
          <CardLabel>Kirim notifikasi uji</CardLabel>
          <form
            action={(fd) =>
              run(async () => {
                await createTestNotification(fd);
              }, { successMessage: "Notifikasi uji terkirim." })
            }
            className="mt-3 flex flex-wrap items-end gap-3"
          >
            <div className="grid gap-1">
              <Label htmlFor="t-type">Tipe</Label>
              <AdminSelect id="t-type" name="type" defaultValue="TEST">
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </AdminSelect>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="t-recipient">Penerima</Label>
              <AdminSelect id="t-recipient" name="recipientId" required>
                <option value="">Pilih staff...</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </AdminSelect>
            </div>
            <div className="grid min-w-50 flex-1 gap-1">
              <Label htmlFor="t-title">Judul</Label>
              <Input id="t-title" name="title" required defaultValue="Notifikasi uji" className="border-border bg-card-2" />
            </div>
            <div className="grid min-w-50 flex-1 gap-1">
              <Label htmlFor="t-body">Isi</Label>
              <Input id="t-body" name="body" required defaultValue="Ini notifikasi uji coba." className="border-border bg-card-2" />
            </div>
            <Button type="submit" size="sm" disabled={isPending}>
              Kirim
            </Button>
          </form>
          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 text-[11.5px] font-semibold text-muted-foreground">
              Atau panggil jalur produksi asli (fan-out ke semua OWNER):
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                run(() => triggerSampleVoidNotification(), {
                  successMessage: "Event contoh void terkirim.",
                })
              }
            >
              Picu contoh event void
            </Button>
          </div>
        </BentoCard>
      )}

      <BentoCard>
        <CardLabel>Filter</CardLabel>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <Label>Tipe</Label>
            <AdminSelect value={filters.type} onChange={(e) => setParam("type", e.target.value)}>
              <option value="ALL">Semua</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </AdminSelect>
          </div>
          <div className="grid gap-1">
            <Label>Status</Label>
            <AdminSelect value={filters.read} onChange={(e) => setParam("read", e.target.value)}>
              <option value="ALL">Semua</option>
              <option value="UNREAD">Belum dibaca</option>
              <option value="READ">Sudah dibaca</option>
            </AdminSelect>
          </div>
          <div className="grid gap-1">
            <Label>Penerima</Label>
            <AdminSelect value={filters.recipient} onChange={(e) => setParam("recipient", e.target.value)}>
              <option value="ALL">Semua</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </AdminSelect>
          </div>
        </div>
      </BentoCard>

      {notifications.length === 0 ? (
        <p className="py-6 text-center text-[12.5px] font-semibold text-muted-foreground">
          Tidak ada notifikasi.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setSelected(n)}
              // A whole Row is the tap target here, so <Button> would force a pill
              // shape onto a full-width row. The focus ring it would have given
              // is added explicitly instead.
              className="cursor-pointer rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Row
                title={n.title}
                meta={
                  <>
                    {n.body}
                    <br />
                    {formatDateTime(n.createdAt)} · {n.recipientName} ({n.recipientRole})
                  </>
                }
                className={n.readAt ? undefined : "border-primary/35 bg-primary-soft"}
              >
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Tag tone={typeTone(n.type)}>{n.type}</Tag>
                  <Tag tone={n.readAt ? "mut" : "acc"}>{n.readAt ? "Dibaca" : "Baru"}</Tag>
                </div>
              </Row>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.title}</DialogTitle>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Tag tone={typeTone(selected.type)}>{selected.type}</Tag>
                  <Tag tone={selected.readAt ? "mut" : "acc"}>{selected.readAt ? "Dibaca" : "Belum"}</Tag>
                  <span className="text-xs text-muted-foreground">{formatDateTime(selected.createdAt)}</span>
                  <span className="text-xs">{selected.recipientName} ({selected.recipientRole})</span>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Isi</div>
                  <div className="whitespace-pre-wrap break-words text-sm">{selected.body}</div>
                </div>

                {(() => {
                  const debugEntries = getDebugEntries(selected.metadata);
                  const hasMetadata =
                    selected.metadata != null &&
                    !(
                      typeof selected.metadata === "object" &&
                      !Array.isArray(selected.metadata) &&
                      Object.keys(selected.metadata as object).length === 0
                    );
                  return (
                    <div className="space-y-3 border-t border-foreground/10 pt-3">
                      <div className="text-xs font-medium text-muted-foreground">Debug</div>
                      <div className="grid gap-1 text-xs">
                        <div className="grid grid-cols-[auto_1fr] gap-x-3">
                          <span className="text-muted-foreground">id</span>
                          <span className="font-mono break-all">{selected.id}</span>
                          <span className="text-muted-foreground">type</span>
                          <span className="font-mono">{selected.type}</span>
                        </div>
                      </div>

                      {debugEntries.length > 0 && (
                        <div className="grid gap-2">
                          {debugEntries.map(([k, v]) => (
                            <div key={k}>
                              <div className="text-[11px] font-medium text-muted-foreground mb-0.5">{k}</div>
                              <pre className="text-xs whitespace-pre-wrap break-words rounded-md bg-muted/50 p-2 font-mono">
                                {v}
                              </pre>
                            </div>
                          ))}
                        </div>
                      )}

                      {hasMetadata ? (
                        <div>
                          <div className="text-[11px] font-medium text-muted-foreground mb-0.5">metadata (raw)</div>
                          <pre className="text-xs whitespace-pre-wrap break-words rounded-md bg-muted/50 p-2 font-mono max-h-64 overflow-auto">
                            {JSON.stringify(selected.metadata, null, 2)}
                          </pre>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground italic">Tidak ada metadata tambahan.</div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
                  Tutup
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(selected.id)} disabled={isPending}>
                  Hapus
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
