import type { RoleEnum } from "@/generated/prisma";

/**
 * The unified navigation model (docs/redesign/SPEC.md): every role shares one
 * bottom tab bar instead of the old hub-and-spoke through "/". Buku is
 * owner-only (the keuangan surface is requireOwner()-gated server-side too);
 * DEVELOPER is a superuser and sees everything an OWNER sees.
 */
export type TabKey = "beranda" | "jual" | "kas" | "buku" | "akun";

export interface TabDef {
  key: TabKey;
  label: string;
  href: string;
  roles: RoleEnum[];
}

export const TABS: TabDef[] = [
  {
    key: "beranda",
    label: "Beranda",
    href: "/beranda",
    roles: ["OWNER", "MANAGER", "CASHIER", "STAFF", "DEVELOPER"],
  },
  {
    key: "jual",
    label: "Jual",
    href: "/kasir",
    roles: ["OWNER", "MANAGER", "CASHIER", "DEVELOPER"],
  },
  {
    key: "kas",
    label: "Kas",
    href: "/kas",
    // STAFF deliberately excluded — the old /cashregister page never granted
    // register access to STAFF, and per-role permission changes need explicit
    // owner approval (CLAUDE.md). Revisit only with a sign-off.
    roles: ["OWNER", "MANAGER", "CASHIER", "DEVELOPER"],
  },
  {
    key: "buku",
    label: "Buku",
    href: "/buku",
    roles: ["OWNER", "DEVELOPER"],
  },
  {
    key: "akun",
    label: "Akun",
    href: "/akun",
    roles: ["OWNER", "MANAGER", "CASHIER", "STAFF", "DEVELOPER"],
  },
];

export function tabsForRole(role: RoleEnum): TabDef[] {
  return TABS.filter((t) => t.roles.includes(role));
}
