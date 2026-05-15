import { Container } from "@/components/shared/container";
import { requireRole } from "@/lib/admin-auth";
import { NotificationBellServer } from "@/components/shared/notification-bell-server";
import { DevNav } from "@/components/admin/dev-nav";

const navItemsBase = [
  { trigger: "Navigasi", content: [
    { href: "/admin", label: "Dashboard" },
    { href: "/", label: "Menu Utama" },
    { href: "/petunjuk", label: "Petunjuk" },
  ]},
  { trigger: "Staff", content: [
    { href: "/admin/staff", label: "Kelola Staff" },
    { href: "/admin/sessions", label: "Sesi Login" },
    { href: "/admin/attendance", label: "Absensi" },
  ]},
  { trigger: "Barang", content: [
    { href: "/admin/inventory", label: "Inventori" },
    { href: "/admin/ingredients", label: "Stok Bahan" },
    { href: "/admin/menu-performance", label: "Performa Menu", ownerOnly: true },
  ]},
  { trigger: "Keuangan", content: [
    { href: "/admin/cash-register", label: "Kas Harian" },
    { href: "/admin/kas-pak-har", label: "Kas Pak Har", ownerOnly: true },
    { href: "/admin/expense-templates", label: "Template Pengeluaran" },
    { href: "/admin/settlement", label: "Pencairan Online" },
  ]},
  { trigger: "Laporan", content: [
    { href: "/admin/reports", label: "Laporan" },
    { href: "/admin/transactions", label: "Transaksi" },
    { href: "/admin/expenses", label: "Pengeluaran" },
  ]},
  { trigger: "Sistem", content: [
    { href: "/admin/notifications", label: "Notifikasi", ownerOnly: true },
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
          <div className="flex items-center gap-2">
            <NotificationBellServer staffId={staff.id} />
            <span className="text-sm truncate text-muted-foreground max-w-45">{displayEmail}</span>
          </div>
        </div>
        <DevNav navItems={navItems} />
      </Container>
      <main className="mt-24 sm:mt-28">
        {children}
      </main>
    </>
  );
}
