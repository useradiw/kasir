import { requireCan } from "@/lib/admin-auth";
import { KasirShell } from "@/components/kasir/kasir-shell";

export default async function KasirPage() {
  await requireCan("kasir.access");
  return <KasirShell />;
}
