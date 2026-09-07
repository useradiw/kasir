import type { RoleEnum } from "@/generated/prisma";
import { BottomNav } from "@/components/shell/bottom-nav";
import { type TabDef, tabsForStaff } from "@/components/shell/nav-items";

/**
 * AppShell — the unified screen frame from the redesign spec: the `.dark`
 * token scope (the approved dark terminal skin) plus the shared bottom tab
 * bar. Existing screens keep working untouched outside the shell; new-tab
 * screens render inside it, so the rollout is per-screen (SPEC section 3).
 *
 * Async server component: tab visibility is resolved here from the capability
 * grid (default + RolePermission overlay) and handed to the client bar, so the
 * client never needs the grid itself.
 */
export async function AppShell({
  role,
  nav = true,
  children,
}: {
  role: RoleEnum;
  nav?: boolean;
  children: React.ReactNode;
}) {
  const tabs: TabDef[] = nav ? await tabsForStaff(role) : [];
  return (
    <div className="dark min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
        <div className="flex-1">{children}</div>
        <BottomNav tabs={tabs} hidden={!nav} />
      </div>
    </div>
  );
}
