import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { requireAuth } from "@/lib/admin-auth";
import { RoleEnum } from "@/generated/prisma";
import { AkunLogout } from "./akun-logout";

/**
 * /akun — the profile tab (SPEC #8): identity, settings, and help in one
 * place. Sign-out lives here as an ACTION row (see AkunLogout) and also on
 * /profile, where account management sits. That does not break the
 * "one place per destination" rule below: that rule is about ROUTES, and a
 * sign-out is an action, not a second way to reach a page.
 */
export default async function AkunPage() {
  const staff = await requireAuth();
  const isAdmin =
    staff.role === "OWNER" || staff.role === "DEVELOPER" || staff.role === "MANAGER";

  const links: { href: string; label: string; detail: string; roles?: RoleEnum[] }[] = [
    { href: "/profile", label: "Profil", detail: "Nama, ganti password, keluar" },
    { href: "/petunjuk", label: "Petunjuk Penggunaan", detail: "Cara pakai tiap layar" },
    // Pengaturan Toko and Backup DB live on the Admin index under Sistem, and
    // are deliberately not repeated here — one place per destination.
    ...(isAdmin
      ? [{ href: "/admin", label: "Admin", detail: "Staff, menu, penjualan, sistem" }]
      : []),
  ];

  return (
    <AppShell role={staff.role}>
      <div className="px-4 pb-1 pt-6">
        <h1 className="font-display text-[17px] font-bold">Akun</h1>
        <p className="text-[11.5px] font-semibold text-muted-foreground">
          {staff.name} · {staff.role}
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 px-4 pb-6 pt-3">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center rounded-2xl border border-border bg-card px-4 py-4 active:scale-[0.99] transition-all duration-150"
          >
            <div>
              <p className="text-[14px] font-bold">{l.label}</p>
              <p className="mt-0.5 text-[11.5px] font-semibold text-muted-foreground">{l.detail}</p>
            </div>
            <span className="ml-auto text-muted-foreground">→</span>
          </Link>
        ))}
        <AkunLogout />
      </div>
    </AppShell>
  );
}
