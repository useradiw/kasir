"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/keuangan", label: "Jurnal" },
  { href: "/admin/keuangan/pengeluaran", label: "Pengeluaran" },
  { href: "/admin/keuangan/transfer", label: "Transfer" },
  { href: "/admin/keuangan/modal", label: "Modal" },
  { href: "/admin/keuangan/prive", label: "Prive" },
  { href: "/admin/keuangan/saldo-awal", label: "Saldo Awal" },
  { href: "/admin/keuangan/kategori", label: "Kategori" },
  { href: "/admin/keuangan/akun", label: "Akun Kas" },
];

export function KeuanganTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 overflow-x-auto border-b pb-2">
      {TABS.map((t) => {
        const active = t.href === "/admin/keuangan" ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
