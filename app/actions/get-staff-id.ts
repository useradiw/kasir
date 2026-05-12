"use server";

import { getStaffIdentity } from "@/lib/admin-auth";

export async function getStaffId() {
  return getStaffIdentity();
}
