import type { Metadata } from "next";
import { AppShell } from "@/components/shell/app-shell";
import { requireRole } from "@/lib/admin-auth";
import { QueryProvider } from "@/components/providers/query-provider";

export const metadata: Metadata = {
  title: "Kasir - Sate Kambing Katamso",
  description: "Kasir Sate Kambing Katamso",
};

export default async function KasirLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // requireRole resolves the session AND gates by role (the page-level check
  // below stays as defense in depth). The shell applies the unified dark
  // scope; the POS keeps its own bottom bars, so the tab bar is off here.
  const staff = await requireRole("OWNER", "MANAGER", "CASHIER");

  return (
    <QueryProvider>
      <AppShell role={staff.role} nav={false}>
        {children}
      </AppShell>
    </QueryProvider>
  );
}
