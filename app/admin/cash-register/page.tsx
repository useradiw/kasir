import { redirect } from "next/navigation";

// Retired per the redesign IA (docs/redesign/SPEC.md #6): /kas is the single
// register surface now; the admin view renders there for owner/manager.
export default async function AdminCashRegisterRedirect({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v) as [string, string][],
  ).toString();
  redirect(`/kas${qs ? `?${qs}` : ""}`);
}
