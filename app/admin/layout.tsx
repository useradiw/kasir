import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Container } from "@/components/shared/container";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"

const navItems = [
  { trigger: "Navigasi", content: [
    { href: "/admin", label: "Dashboard" },
    { href: "/kasir", label: "Kembali ke kasir" }
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
    { href: "/admin/transactions", label: "Transaksi" },
    { href: "/admin/expenses", label: "Pengeluaran" },
    { href: "/admin/cash-register", label: "Kas Harian" },
  ]},
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth check (no Prisma here — each page's query handles OWNER role validation)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const displayEmail = user.email ?? "Admin";

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
