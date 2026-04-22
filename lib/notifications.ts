import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@/generated/prisma";

type CreateArgs = {
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
};

// Create one Notification row per active OWNER (excluding the actor).
export async function notifyOwners(args: CreateArgs) {
  const owners = await prisma.staff.findMany({
    where: { role: "OWNER", isActive: true, ...(args.actorId ? { NOT: { id: args.actorId } } : {}) },
    select: { id: true },
  });
  if (owners.length === 0) return;
  await prisma.notification.createMany({
    data: owners.map((o) => ({
      recipientId: o.id,
      type: args.type,
      title: args.title,
      body: args.body,
      metadata: args.metadata as never,
    })),
  });
}

export async function notifyStaff(recipientId: string, args: Omit<CreateArgs, "actorId">) {
  await prisma.notification.create({
    data: {
      recipientId,
      type: args.type,
      title: args.title,
      body: args.body,
      metadata: args.metadata as never,
    },
  });
}

export async function createVoidNotification(params: {
  type: "TRANSACTION_VOIDED" | "SESSION_VOIDED";
  actorName: string;
  actorId?: string | null;
  subjectLabel: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const title =
    params.type === "TRANSACTION_VOIDED"
      ? `Transaksi dibatalkan oleh ${params.actorName}`
      : `Sesi dibatalkan oleh ${params.actorName}`;
  const body = params.reason
    ? `${params.subjectLabel} — alasan: ${params.reason}`
    : params.subjectLabel;
  await notifyOwners({
    type: params.type,
    title,
    body,
    metadata: params.metadata,
    actorId: params.actorId ?? null,
  });
}
