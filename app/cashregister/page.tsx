import { redirect } from "next/navigation";

// Retired per the redesign IA (docs/redesign/SPEC.md #6): /kas is the single
// register surface now. Old links keep working through this redirect.
export default async function CashRegisterRedirect({
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
