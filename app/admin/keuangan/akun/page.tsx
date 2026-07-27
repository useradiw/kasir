import { listCashAccounts } from "@/app/actions/admin/queries";
import { AkunClient } from "./akun-client";

export const dynamic = "force-dynamic";

export default async function AkunKasPage() {
  const accounts = await listCashAccounts(true);
  return <AkunClient accounts={accounts} />;
}
