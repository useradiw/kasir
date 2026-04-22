"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/actions/notifications";

export type BellNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: Date | string | null;
  createdAt: Date | string;
};

export function NotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: BellNotification[];
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const handleItemClick = (id: string, readAt: BellNotification["readAt"]) => {
    if (readAt) return;
    startTransition(async () => {
      try {
        await markNotificationRead(id);
      } catch (e) {
        notify.error(e);
      }
    });
  };

  const handleMarkAll = () => {
    startTransition(async () => {
      try {
        await markAllNotificationsRead();
        notify.success("Semua notifikasi ditandai dibaca.");
      } catch (e) {
        notify.error(e);
      }
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifikasi"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-lg">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-medium">Notifikasi</span>
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Tandai semua dibaca
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Tidak ada notifikasi.
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleItemClick(n.id, n.readAt)}
                    className={cn(
                      "block w-full border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent",
                      !n.readAt && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{n.title}</span>
                      {!n.readAt && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{n.body}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {formatDateTime(n.createdAt)}
                    </div>
                  </button>
                ))
              )}
            </div>
            <Link
              href="/admin/notifications"
              onClick={() => setOpen(false)}
              className="block border-t px-3 py-2 text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Lihat semua
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
