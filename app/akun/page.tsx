import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { requireAuth } from "@/lib/admin-auth";
import { RoleEnum } from "@/generated/prisma";

/**
 * /akun — the profile tab (SPEC #8): identity, settings, and help in one
 * place. Sign-out lives on /profile; this page links to it.
 */
export default async function AkunPage() {
  const staff = await requireAuth();
  const isOwner = staff.role === "OWNER" || staff.role === "DEVELOPER";

  const links: { href: string; label: string; detail: string; roles?: RoleEnum[] }[] = [
    { href: "/profile", label: "Profil", detail: "Nama, ganti password, keluar" },
    { href: "/settlement", label: "Pencairan Online", detail: "Catat settlement GoFood/Grab" },
    { href: "/petunjuk", label: "Petunjuk Penggunaan", detail: "Cara pakai tiap layar" },
    ...(isOwner
      ? [
          { href: "/settings", label: "Pengaturan Toko", detail: "Pajak, service, jam kunci kas" },
          { href: "/admin/backup", label: "Backup Database", detail: "Unduh salinan lengkap" },
          { href: "/admin/staff", label: "Kelola Staff", detail: "Tambah, nonaktifkan, absensi" },
        ]
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
      </div>
    </AppShell>
  );
}
