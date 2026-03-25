"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { z } from "zod";

const statusEnum = z.enum(["PRESENT", "ABSENT"]);

export async function markAttendance(staffId: string, date: string, status: "PRESENT" | "ABSENT") {
  await requireOwner();

  statusEnum.parse(status);
  const parsedDate = new Date(date);
  parsedDate.setHours(0, 0, 0, 0);

  await prisma.attendanceRecord.upsert({
    where: { staffId_date: { staffId, date: parsedDate } },
    create: { staffId, date: parsedDate, status },
    update: { status },
  });
  revalidatePath("/admin/attendance");
}

export async function bulkMarkAttendance(
  date: string,
  entries: Array<{ staffId: string; status: "PRESENT" | "ABSENT" }>
) {
  await requireOwner();

  const parsedDate = new Date(date);
  parsedDate.setHours(0, 0, 0, 0);

  await prisma.$transaction(
    entries.map((e) =>
      prisma.attendanceRecord.upsert({
        where: { staffId_date: { staffId: e.staffId, date: parsedDate } },
        create: { staffId: e.staffId, date: parsedDate, status: e.status },
        update: { status: e.status },
      })
    )
  );
  revalidatePath("/admin/attendance");
}
