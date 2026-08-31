import type { RoleEnum } from "@/generated/prisma";
import { BottomNav } from "@/components/shell/bottom-nav";

/**
 * AppShell — the unified screen frame from the redesign spec: the `.dark`
 * token scope (the approved dark terminal skin) plus the shared bottom tab
 * bar. Existing screens keep working untouched outside the shell; new-tab
 * screens render inside it, so the rollout is per-screen (SPEC section 3).
 */
export function AppShell({
  role,
  nav = true,
  children,
}: {
  role: RoleEnum;
  nav?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="dark min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
        <div className="flex-1">{children}</div>
      </div>
      <BottomNav role={role} hidden={!nav} />
    </div>
  );
}
