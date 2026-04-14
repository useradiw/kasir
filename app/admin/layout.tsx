import Link from "next/link";
import { Container } from "@/components/shared/container";
import { requireRole } from "@/lib/admin-auth";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"

const navItemsBase = [
  { trigger: "Navigasi", content: [
    { href: "/admin", label: "Dashboard" },
    { href: "/", label: "Menu Utama" }
  ]},
  { trigger: "Staff", content: [
    { href: "/admin/staff", label: "Kelola Staff" },
    { href: "/admin/sessions", label: "Sesi Login" },
    { href: "/admin/attendance", label: "Absensi" },
  ]},
  { trigger: "Barang", content: [
    { href: "/admin/inventory", label: "Inventori" },
  ]},
  { trigger: "Laporan", content: [
    { href: "/admin/reports", label: "Laporan", ownerOnly: true },
    { href: "/admin/transactions", label: "Transaksi" },
    { href: "/admin/expenses", label: "Pengeluaran" },
    { href: "/admin/cash-register", label: "Kas Harian" },
  ]},
  { trigger: "Sistem", content: [
    { href: "/admin/backup", label: "Backup DB", ownerOnly: true },
    { href: "/settings", label: "Pengaturan", ownerOnly: true },
  ]},
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireRole("OWNER", "MANAGER");
  const isOwner = staff.role === "OWNER";
  const displayEmail = staff.name ?? "Admin";

  const navItems = navItemsBase.map((group) => ({
    ...group,
    content: group.content.filter((item) => !("ownerOnly" in item) || !item.ownerOnly || isOwner),
  })).filter((group) => group.content.length > 0);

  return (
    <>
      <Container id="nav" sectionStyle="border z-40 fixed top-0 right-0 left-0 bg-inherit shadow" className="flex flex-col">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">Admin Panel</span>
          <span className="text-sm truncate text-muted-foreground max-w-45">{displayEmail}</span>
        </div>
        <NavigationMenu className="mt-2" align="start">
          <NavigationMenuList className="gap-0 justify-start">
              {navItems.map((item) => (
                <NavigationMenuItem key={item.trigger}>
                  <NavigationMenuTrigger className="text-xs sm:text-sm px-2.5 sm:px-4">
                    {item.trigger}
                  </NavigationMenuTrigger>
                  {item.content.map((item) => (
                    <NavigationMenuContent key={item.label}>
                      <NavigationMenuLink
                        render={<Link href={item.href} className="cursor-pointer" />}
                        className={navigationMenuTriggerStyle()}
                      >
                        {item.label}
                      </NavigationMenuLink>
                    </NavigationMenuContent>
                  ))}
                </NavigationMenuItem>
              ))}
          </NavigationMenuList>
        </NavigationMenu>
      </Container>
      <main className="mt-24 sm:mt-28">
        {children}
      </main>
    </>
  );
}
