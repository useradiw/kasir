import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/staff", label: "Staff" },
  { href: "/admin/sessions", label: "Sesi Login" },
  { href: "/admin/inventory", label: "Inventori" },
  { href: "/admin/transactions", label: "Transaksi" },
  { href: "/admin/expenses", label: "Pengeluaran" },
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
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-foreground/10 bg-card">
        <div className="p-4 border-b border-foreground/10">
          <p className="text-xs text-muted-foreground">Admin Panel</p>
          <p className="text-sm font-semibold truncate">{displayEmail}</p>
        </div>
        <nav className="p-2 flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-4 left-0 w-56 p-2">
          <Link
            href="/kasir"
            className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            ← Kembali ke Kasir
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
