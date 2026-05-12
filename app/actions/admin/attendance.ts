"use server";

import { revalidateAttendance } from "@/lib/revalidate";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";
import { z } from "zod";
import { runAction } from "@/lib/action-error";

const statusEnum = z.enum(["PRESENT", "ABSENT"]);

export async function markAttendance(staffId: string, date: string, status: "PRESENT" | "ABSENT") {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    statusEnum.parse(status);
    // Parse YYYY-MM-DD as local date (not UTC)
    const [y, m, d] = date.split("-").map(Number);
    const parsedDate = new Date(y, m - 1, d);

    await prisma.attendanceRecord.upsert({
      where: { staffId_date: { staffId, date: parsedDate } },
      create: { staffId, date: parsedDate, status },
      update: { status },
    });
    revalidateAttendance();
  });
}

export async function bulkMarkAttendance(
  date: string,
  entries: Array<{ staffId: string; status: "PRESENT" | "ABSENT" }>
) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    // Parse YYYY-MM-DD as local date (not UTC)
    const [y, m, d] = date.split("-").map(Number);
    const parsedDate = new Date(y, m - 1, d);

    await prisma.$transaction(
      entries.map((e) =>
        prisma.attendanceRecord.upsert({
          where: { staffId_date: { staffId: e.staffId, date: parsedDate } },
          create: { staffId: e.staffId, date: parsedDate, status: e.status },
          update: { status: e.status },
        })
      )
    );
    revalidateAttendance();
  });
}
