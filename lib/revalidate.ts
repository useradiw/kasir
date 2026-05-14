import { revalidatePath } from "next/cache";

/** Revalidate all pages that display inventory/recipe data. */
export function revalidateInventory() {
  revalidatePath("/admin/inventory");
}

/** Revalidate all pages that display expense data. */
export function revalidateExpenses() {
  revalidatePath("/admin/expenses");
  revalidatePath("/admin/kas-pak-har");
}

/** Revalidate all pages that display cash register data. */
export function revalidateCashRegister() {
  revalidatePath("/cashregister");
  revalidatePath("/admin/cash-register");
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

/** Revalidate all pages that display expense template data. */
export function revalidateExpenseTemplates() {
  revalidatePath("/admin/expense-templates");
}

/** Revalidate all pages that display settings. */
export function revalidateSettings() {
  revalidatePath("/settings");
  revalidatePath("/kasir");
  revalidatePath("/cashregister");
  revalidatePath("/admin/cash-register");
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

/** Revalidate ingredient stock page and related inventory. */
export function revalidateIngredients() {
  revalidatePath("/admin/ingredients");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/expense-templates");
}
