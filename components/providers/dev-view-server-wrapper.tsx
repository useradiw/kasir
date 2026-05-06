import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { DevViewProvider } from "./dev-view-provider";
import type { RoleEnum } from "@/generated/prisma";

export async function DevViewServerWrapper({ children }: { children: React.ReactNode }) {
  // Try to get the authenticated user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Unauthenticated — render plain (login page, etc.)
    return <>{children}</>;
  }

  // Look up staff record
  const staff = await prisma.staff.findUnique({
    where: { supabaseUserId: user.id },
    select: { role: true, isActive: true },
  });

  if (!staff || !staff.isActive) {
    return <>{children}</>;
  }

  // Only OWNER needs to check the dev_mode setting
  let isDevMode = false;
  if (staff.role === "OWNER") {
    const devModeSetting = await getSetting("dev_mode");
    isDevMode = devModeSetting === "true";
  }

  return (
    <DevViewProvider realRole={staff.role as RoleEnum} isDevMode={isDevMode}>
      {children}
    </DevViewProvider>
  );
}
