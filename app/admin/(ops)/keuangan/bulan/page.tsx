import { requireOwner } from "@/lib/admin-auth";
import { listMonths } from "@/app/actions/admin/queries";
import { BulanClient } from "./bulan-client";

export const dynamic = "force-dynamic";

/**
 * Bulan (tutup buku) — lock/unlock accounting months (Slice 5). Creating a
 * month is handled by the MonthPicker in the shared Keuangan layout (the
 * "+ Bulan" control) — this page only lists existing months and offers the
 * lock/unlock actions.
 */
export default async function BulanPage() {
  await requireOwner();
  const months = await listMonths();
  return <BulanClient months={months} />;
}
