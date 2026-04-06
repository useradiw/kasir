import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/shared/container";
import { LoginForm } from "@/components/login-form";
import { RoleBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { signOut } from "@/app/actions/sign-out";
import {
  ShoppingCart,
  LayoutDashboard,
  Users,
  Monitor,
  ClipboardCheck,
  Package,
  Receipt,
  Wallet,
  Landmark,
  LogOut,
} from "lucide-react";

const kasirLinks = [
  { href: "/kasir", label: "Kasir", desc: "Buka halaman kasir (POS)", icon: ShoppingCart },
];

const adminLinks = [
  { href: "/admin", label: "Dashboard", desc: "Ringkasan & statistik", icon: LayoutDashboard },
  { href: "/admin/staff", label: "Kelola Staff", desc: "Tambah & atur staff", icon: Users },
  { href: "/admin/sessions", label: "Sesi Login", desc: "Aktivitas login pengguna", icon: Monitor },
  { href: "/admin/attendance", label: "Absensi", desc: "Pencatatan kehadiran", icon: ClipboardCheck },
  { href: "/admin/inventory", label: "Inventori", desc: "Kategori & menu", icon: Package },
  { href: "/admin/transactions", label: "Transaksi", desc: "Riwayat transaksi", icon: Receipt },
  { href: "/admin/expenses", label: "Pengeluaran", desc: "Catat pengeluaran", icon: Wallet },
  { href: "/admin/cash-register", label: "Kas Harian", desc: "Buka & tutup kas", icon: Landmark },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Container id="main" sectionStyle="bg-white dark:bg-black" className="flex h-screen justify-center items-center">
        <LoginForm />
      </Container>
    );
  }

  const staff = await prisma.staff.findUnique({
    where: { supabaseUserId: user.id },
  });

  const staffName = staff?.name ?? user.email ?? "Pengguna";
  const staffRole = staff?.role ?? "STAFF";
  const isOwner = staffRole === "OWNER";

  return (
    <Container id="menu" sectionStyle="bg-white dark:bg-black min-h-screen" className="py-6">
      <div className="flex items-center justify-between mb-6">
        <Link href="/profile" className="hover:underline">
          <h1 className="text-lg font-bold">{staffName}</h1>
          <RoleBadge role={staffRole} />
        </Link>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm" className="cursor-pointer gap-1.5">
            <LogOut className="size-4" />
            Keluar
          </Button>
        </form>
      </div>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Kasir</h2>
        <div className="grid gap-3">
          {kasirLinks.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
                <CardHeader className="flex-row items-center gap-3 py-3">
                  <item.icon className="size-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <CardTitle className="text-sm">{item.label}</CardTitle>
                    <CardDescription className="text-xs">{item.desc}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {isOwner && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Admin</h2>
          <div className="grid gap-3">
            {adminLinks.map((item) => (
              <Link key={item.href} href={item.href}>
                <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
                  <CardHeader className="flex-row items-center gap-3 py-3">
                    <item.icon className="size-5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <CardTitle className="text-sm">{item.label}</CardTitle>
                      <CardDescription className="text-xs">{item.desc}</CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}
