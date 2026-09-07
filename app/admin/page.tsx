import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { requireCan } from "@/lib/admin-auth";
import { RoleEnum } from "@/generated/prisma";

/**
 * /admin — the admin navigation index (redesign plan, section 4). Replaces
 * the old stat-card dashboard (deleted: it duplicated the /beranda bento)
 * and the layout dropdown (deleted: dead end for a MANAGER on a phone).
 */

type AdminLink = { href: string; label: string; detail: string; ownerOnly?: boolean };
type AdminGroup = { title: string; links: AdminLink[] };

const groupsBase: AdminGroup[] = [
  {
    title: "Staff",
    links: [
      { href: "/admin/staff", label: "Kelola Staff", detail: "Tambah, edit, nonaktifkan staff" },
      { href: "/admin/sessions", label: "Sesi Login", detail: "Sesi aktif dan riwayat login" },
      { href: "/admin/attendance", label: "Absensi", detail: "Jam masuk dan pulang staff" },
    ],
  },
  {
    title: "Menu",
    links: [
      { href: "/admin/inventory", label: "Menu Management", detail: "Ketersediaan item menu" },
      { href: "/admin/menu-performance", label: "Performa Menu", detail: "Menu terlaris dan lambat", ownerOnly: true },
      { href: "/admin/suppliers", label: "Supplier", detail: "Data pemasok bahan baku" },
    ],
  },
  {
    title: "Penjualan",
    links: [
      { href: "/admin/reports", label: "Laporan", detail: "Penjualan dan operasional" },
      { href: "/admin/transactions", label: "Transaksi", detail: "Riwayat semua transaksi" },
      { href: "/settlement", label: "Pencairan Online", detail: "Pencairan dana platform online" },
    ],
  },
  {
    title: "Sistem",
    links: [
      { href: "/admin/notifications", label: "Notifikasi", detail: "Pengaturan notifikasi staff", ownerOnly: true },
      { href: "/admin/backup", label: "Backup DB", detail: "Unduh salinan lengkap", ownerOnly: true },
      { href: "/settings", label: "Pengaturan Toko", detail: "Pajak, service, jam kunci kas", ownerOnly: true },
    ],
  },
];

export default async function AdminPage() {
  const staff = await requireCan("admin.ops");
  const isOwner = staff.role === "OWNER" || (staff.role as RoleEnum) === "DEVELOPER";

  const groups = groupsBase
    .map((group) => ({
      ...group,
      links: group.links.filter((l) => !l.ownerOnly || isOwner),
    }))
    .filter((group) => group.links.length > 0);

  return (
    <AppShell role={staff.role}>
      <div className="px-4 pb-1 pt-6">
        <h1 className="font-display text-[17px] font-bold">Admin</h1>
        <p className="text-[11.5px] font-semibold text-muted-foreground">
          {staff.name} · {staff.role}
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-5 px-4 pb-6 pt-3">
        {groups.map((group) => (
          <div key={group.title} className="flex flex-col gap-2.5">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </p>
            {group.links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="cursor-pointer flex items-center rounded-2xl border border-border bg-card px-4 py-4 active:scale-[0.99] transition-all duration-150"
              >
                <div>
                  <p className="text-[14px] font-bold">{l.label}</p>
                  <p className="mt-0.5 text-[11.5px] font-semibold text-muted-foreground">{l.detail}</p>
                </div>
                <span className="ml-auto text-muted-foreground">→</span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
