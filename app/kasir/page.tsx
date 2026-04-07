import { requireAuth } from "@/lib/admin-auth";
import { KasirShell } from "@/components/kasir/kasir-shell";

export default async function KasirPage() {
  await requireAuth();
  return <KasirShell />;
}
