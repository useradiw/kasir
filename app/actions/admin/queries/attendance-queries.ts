"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";

export async function getAttendanceData(opts: { date: string }) {
  await requireRole("OWNER", "MANAGER");

  let targetDate: Date;
  if (opts.date) {
    // Parse YYYY-MM-DD as local date (not UTC)
    const [y, m, d] = opts.date.split("-").map(Number);
    targetDate = new Date(y, m - 1, d);
  } else {
    const now = new Date();
    targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const [activeStaffList, records] = await Promise.all([
    prisma.staff.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.attendanceRecord.findMany({ where: { date: targetDate } }),
  ]);

  const recordMap = new Map(records.map((r) => [r.staffId, r]));

  const staffAttendance = activeStaffList.map((s) => {
    const record = recordMap.get(s.id);
    return {
      staffId: s.id,
      staffName: s.name,
      role: s.role as string,
      status: (record?.status as "PRESENT" | "ABSENT") ?? null,
      recordId: record?.id ?? null,
    };
  });

  const present = staffAttendance.filter((s) => s.status === "PRESENT").length;
  const absent = staffAttendance.filter((s) => s.status === "ABSENT").length;

  // Format date as local YYYY-MM-DD (not toISOString which converts to UTC)
  const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;

  return {
    date: dateStr,
    staffAttendance,
    summary: {
      total: staffAttendance.length,
      present,
      absent,
      unmarked: staffAttendance.length - present - absent,
    },
  };
}
