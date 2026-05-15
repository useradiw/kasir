import { requireRole } from "@/lib/admin-auth";
import { KasirShell } from "@/components/kasir/kasir-shell";

export default async function KasirPage() {
  await requireRole("OWNER", "MANAGER", "CASHIER");
  return <KasirShell />;
}
