import { revalidatePath } from "next/cache";

/** Revalidate all pages that display inventory/recipe data. */
export function revalidateInventory() {
  revalidatePath("/admin/inventory");
}

/** Revalidate all pages that display cash register data. */
export function revalidateCashRegister() {
  revalidatePath("/kas");
}

/** Revalidate all pages that display transaction data. */
export function revalidateTransactions() {
  revalidatePath("/admin/transactions");
  revalidatePath("/admin/notifications");
}

/** Revalidate all pages that display staff data. */
export function revalidateStaff() {
  revalidatePath("/admin/staff");
}

/** Revalidate all pages that display notification data. */
export function revalidateNotifications() {
  revalidatePath("/admin");
  revalidatePath("/admin/notifications");
}

/** Revalidate all pages that display attendance data. */
export function revalidateAttendance() {
  revalidatePath("/admin/attendance");
}

/** Revalidate all pages that display settings. */
export function revalidateSettings() {
  revalidatePath("/settings");
  revalidatePath("/kasir");
  revalidatePath("/kas");
}

/** Revalidate profile pages. */
export function revalidateProfile() {
  revalidatePath("/profile");
  revalidatePath("/");
}

/** Revalidate settlement and report pages. */
export function revalidateSettlement() {
  revalidatePath("/settlement");
  revalidatePath("/admin/reports");
}

/** Revalidate supplier pages. */
export function revalidateSuppliers() {
  revalidatePath("/admin/suppliers");
}

/** Revalidate all pages under the Keuangan (Warung Books) section. */
export function revalidateKeuangan() {
  revalidatePath("/admin/keuangan", "layout");
}
