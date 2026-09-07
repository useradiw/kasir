import type { RoleEnum } from "@/generated/prisma";
import { isAllowed, NO_OVERRIDES, type Capability, type GridOverride } from "@/lib/permissions";
import { loadPermissionOverride } from "@/lib/permission-store";

/**
 * The unified navigation model (docs/redesign/SPEC.md): every role shares one
 * bottom tab bar instead of the old hub-and-spoke through "/". DEVELOPER is a
 * superuser and sees everything an OWNER sees.
 *
 * Tab visibility comes from the SAME capability grid that gates the routes
 * server-side (lib/permissions.ts), instead of a second roles list that can
 * drift from the gates. beranda and akun are open to every active staff member
 * (requireAuth areas, no capability).
 *
 * Buku is NOT a tab here — it is buku.read-gated server-side too, and a bar
 * shared by every role should not carry a link most roles can never use. The
 * owner reaches it instead from a link on /beranda.
 */
export type TabKey = "beranda" | "jual" | "kas" | "akun";

export interface TabDef {
  key: TabKey;
  label: string;
  href: string;
  /** null = every active staff member sees this tab. */
  capability: Capability | null;
}

export const TABS: TabDef[] = [
  { key: "beranda", label: "Beranda", href: "/beranda", capability: null },
  { key: "jual", label: "Kasir", href: "/kasir", capability: "kasir.access" },
  // STAFF deliberately excluded: kas.access's default grid is MANAGER/CASHIER
  // only — the old /cashregister page never granted register access to STAFF,
  // and per-role permission changes need explicit owner approval (CLAUDE.md).
  // The Owner can still grant it from the permission screen.
  { key: "kas", label: "Kas", href: "/kas", capability: "kas.access" },
  { key: "akun", label: "Akun", href: "/akun", capability: null },
];

// Sync, default-grid only — for pure contexts (tests, offline fallback).
export function tabsForRole(role: RoleEnum, overrides: GridOverride = NO_OVERRIDES): TabDef[] {
  return TABS.filter((t) => !t.capability || isAllowed(t.capability, role, overrides));
}

// The server path: same grid with the RolePermission overlay applied.
export async function tabsForStaff(role: RoleEnum): Promise<TabDef[]> {
  return tabsForRole(role, await loadPermissionOverride());
}
