import Link from "next/link";
import { Container } from "@/components/shared/container";
import { requireRole } from "@/lib/admin-auth";
import { NotificationBellServer } from "@/components/shared/notification-bell-server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireRole("OWNER", "MANAGER");
  const displayEmail = staff.name ?? "Admin";

  return (
    <>
      <Container id="nav" sectionStyle="border z-40 fixed top-0 right-0 left-0 bg-inherit shadow" className="flex flex-col justify-between">
        <div className="flex justify-between">
          <Link href="/admin" className="text-lg font-semibold">
            ← Admin
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBellServer staffId={staff.id} />
            <span className="text-sm truncate text-muted-foreground max-w-45">{displayEmail}</span>
          </div>
        </div>
      </Container>
      <main className="mt-15">
        {children}
      </main>
    </>
  );
}
