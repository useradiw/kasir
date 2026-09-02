import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import NotificationsClient from "./notifications-client";

const TYPES = ["TRANSACTION_VOIDED", "SESSION_VOIDED", "TEST"] as const;
type TypeFilter = (typeof TYPES)[number] | "ALL";
type ReadFilter = "ALL" | "UNREAD" | "READ";

export default async function NotificationsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; read?: string; recipient?: string }>;
}) {
  const staff = await requireOwner();
  const params = await searchParams;

  const typeFilter: TypeFilter =
    params.type && (TYPES as readonly string[]).includes(params.type)
      ? (params.type as TypeFilter)
      : "ALL";
  const readFilter: ReadFilter =
    params.read === "UNREAD" || params.read === "READ" ? params.read : "ALL";
  const recipientFilter = params.recipient ?? "ALL";

  const where: Record<string, unknown> = {};
  if (typeFilter !== "ALL") where.type = typeFilter;
  if (readFilter === "UNREAD") where.readAt = null;
  if (readFilter === "READ") where.readAt = { not: null };
  if (recipientFilter !== "ALL") where.recipientId = recipientFilter;

  const [notifications, staffList, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { recipient: { select: { id: true, name: true, role: true } } },
    }),
    prisma.staff.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
    prisma.notification.count({ where: { readAt: null } }),
  ]);

  const rows = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    metadata: n.metadata as unknown,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
    recipientName: n.recipient.name,
    recipientRole: n.recipient.role,
  }));

  return (
    <AppShell role={staff.role}>
      <div className="px-4 pb-1 pt-6">
        <Link href="/admin" className="text-[12.5px] font-bold text-muted-foreground">
          ← Admin
        </Link>
        <h1 className="font-display mt-2 text-[17px] font-bold">Notifikasi</h1>
        <p className="text-[11.5px] font-semibold text-muted-foreground">
          {unreadCount} belum dibaca
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-6 pt-3">
        <NotificationsClient
          notifications={rows}
          staffList={staffList}
          filters={{ type: typeFilter, read: readFilter, recipient: recipientFilter }}
        />
      </div>
    </AppShell>
  );
}
