"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";
import { z } from "zod";

const statusEnum = z.enum(["PRESENT", "ABSENT"]);

export async function markAttendance(staffId: string, date: string, status: "PRESENT" | "ABSENT") {
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
  revalidatePath("/admin/attendance");
}

export async function bulkMarkAttendance(
  date: string,
  entries: Array<{ staffId: string; status: "PRESENT" | "ABSENT" }>
) {
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
  revalidatePath("/admin/attendance");
}
