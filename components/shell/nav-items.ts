import type { RoleEnum } from "@/generated/prisma";

/**
 * The unified navigation model (docs/redesign/SPEC.md): every role shares one
 * bottom tab bar instead of the old hub-and-spoke through "/". DEVELOPER is a
 * superuser and sees everything an OWNER sees.
 *
 * Buku is NOT a tab here — it is owner-only (requireOwner()-gated server-side
 * too), and a bar shared by every role should not carry a link most roles can
 * never use. The owner reaches it instead from a link on /beranda.
 */
export type TabKey = "beranda" | "jual" | "kas" | "akun";

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
    label: "Kasir",
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
    key: "akun",
    label: "Akun",
    href: "/akun",
    roles: ["OWNER", "MANAGER", "CASHIER", "STAFF", "DEVELOPER"],
  },
];

export function tabsForRole(role: RoleEnum): TabDef[] {
  return TABS.filter((t) => t.roles.includes(role));
}
