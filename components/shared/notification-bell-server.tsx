import { prisma } from "@/lib/prisma";
import { NotificationBell } from "@/components/shared/notification-bell";

export async function NotificationBellServer({ staffId }: { staffId: string }) {
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: staffId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({
      where: { recipientId: staffId, readAt: null },
    }),
  ]);

  return <NotificationBell notifications={notifications} unreadCount={unreadCount} />;
}
