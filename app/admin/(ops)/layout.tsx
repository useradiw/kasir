import { requireCan } from "@/lib/admin-auth";

/**
 * Layout for the admin ops children (sessions, attendance, suppliers, …).
 * The old fixed "← Admin" top bar + bell + email strip is gone — each page
 * now owns its own AppShell (dark scope + bottom nav) and header, matching
 * the rest of the redesign (docs/redesign/design.md section 3.1). This
 * layout keeps the shared auth gate only; every child already re-checks
 * `requireCan("admin.ops")` itself, so this is defense in depth, not the only gate.
 */
export default async function AdminOpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCan("admin.ops");
  return <>{children}</>;
}
