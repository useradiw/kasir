import type { RoleEnum } from "@/generated/prisma";

/**
 * The capability layer — one named permission per thing the app can gate on.
 *
 * Every gate helper call in the app (requireOwner / requireRole / their Strict
 * variants) resolves to one of the capabilities below. The role -> capability
 * grid is stored in code (DEFAULT_GRID, the source of truth for a fresh
 * install) and later overlaid by the RolePermission table, which is an
 * override layer the Owner edits from the permission screen.
 *
 * Semantics, fixed for every capability:
 * - OWNER is always allowed. The Owner row is NOT stored and NOT editable —
 *   an Owner who could revoke their own staff.write could never restore it,
 *   and there is no second Owner to repair the shop.
 * - DEVELOPER passes non-strict checks as a superuser. Its powers are defined
 *   here in code, not in the grid, so the DEVELOPER row is not editable either.
 * - MANAGER / CASHIER / STAFF are allowed when the override table says so, or
 *   — for a capability with no stored row — when DEFAULT_GRID says so. A
 *   missing row falls back to the default, never to "allowed".
 * - Strict checks (hard deletes) never admit DEVELOPER, exactly like the
 *   requireRoleStrict / requireOwnerStrict they replace.
 *
 * Day-one behaviour is byte-identical to the hardcoded checks this replaces:
 * each capability's default grid reproduces the exact gate that used to sit at
 * its call sites. test/permissions-matrix.test.ts pins that equivalence.
 */

export const CAPABILITY_GROUPS = [
  "Kasir & Transaksi",
  "Kas & Register",
  "Menu & Supplier",
  "Laporan & Admin",
  "Buku (Keuangan)",
] as const;

export type CapabilityGroup = (typeof CAPABILITY_GROUPS)[number];

/** The full capability catalogue: dotted area.verb names, grouped for the UI. */
export const CAPABILITIES = {
  // --- Kasir & Transaksi ---
  "kasir.access": { label: "Buka layar Kasir", group: "Kasir & Transaksi" },
  "kas.access": { label: "Buka layar Kas (register)", group: "Kasir & Transaksi" },
  "settlement.use": { label: "Lihat dan buat settlement online", group: "Kasir & Transaksi" },
  "settlement.delete": { label: "Hapus settlement", group: "Kasir & Transaksi" },
  "transaksi.write": { label: "Void / ubah transaksi", group: "Kasir & Transaksi" },
  "transactions.read": { label: "Lihat daftar transaksi", group: "Kasir & Transaksi" },

  // --- Kas & Register ---
  "cashregister.read": { label: "Lihat data register kas", group: "Kas & Register" },
  "cashregister.write": { label: "Buka / tutup / ubah register kas", group: "Kas & Register" },
  "cashregister.delete": { label: "Hapus register kas", group: "Kas & Register" },
  "dayclose.repost": { label: "Posting ulang day-close", group: "Kas & Register" },

  // --- Menu & Supplier ---
  "menu.read": { label: "Lihat menu & stok", group: "Menu & Supplier" },
  "menu.write": { label: "Ubah menu, varian, paket, harga online", group: "Menu & Supplier" },
  "menu.delete": { label: "Hapus menu / varian / paket", group: "Menu & Supplier" },
  "menu.performance": { label: "Lihat performa menu", group: "Menu & Supplier" },
  "suppliers.write": { label: "Kelola supplier", group: "Menu & Supplier" },

  // --- Laporan & Admin ---
  "reports.read": { label: "Lihat laporan penjualan", group: "Laporan & Admin" },
  "admin.ops": { label: "Masuk layar Admin & dashboard", group: "Laporan & Admin" },
  "attendance.manage": { label: "Kelola absensi", group: "Laporan & Admin" },
  "staff.read": { label: "Lihat data staf", group: "Laporan & Admin" },
  "staff.write": { label: "Tambah / ubah / aktifkan staf", group: "Laporan & Admin" },
  "staff.delete": { label: "Hapus staf", group: "Laporan & Admin" },
  "settings.write": { label: "Ubah pengaturan toko", group: "Laporan & Admin" },
  "notifications.admin": { label: "Kelola notifikasi", group: "Laporan & Admin" },
  "notifications.delete": { label: "Hapus notifikasi", group: "Laporan & Admin" },
  "backup.export": { label: "Unduh backup database", group: "Laporan & Admin" },
  "backup.restore": { label: "Restore database", group: "Laporan & Admin" },

  // --- Buku (Keuangan) ---
  "buku.read": { label: "Buka layar Buku & jurnal", group: "Buku (Keuangan)" },
  "pengeluaran.write": { label: "Catat pengeluaran", group: "Buku (Keuangan)" },
  "pengeluaran.void": { label: "Void pengeluaran", group: "Buku (Keuangan)" },
  "buku.akun.write": { label: "Kelola kategori & akun (chart of accounts)", group: "Buku (Keuangan)" },
  "buku.kas.write": { label: "Catat kas: transfer, modal, prive, saldo awal, cek saldo", group: "Buku (Keuangan)" },
  "buku.bulan.write": { label: "Kelola & kunci bulan buku", group: "Buku (Keuangan)" },
} as const;

export type Capability = keyof typeof CAPABILITIES;

export const CAPABILITY_KEYS = Object.keys(CAPABILITIES) as Capability[];

export function isCapability(value: string): value is Capability {
  return Object.prototype.hasOwnProperty.call(CAPABILITIES, value);
}

/**
 * The default grid — which of the three toggleable roles each capability is
 * granted to on a fresh install. OWNER and DEVELOPER are absent ON PURPOSE:
 * their grants are code invariants (see the header), not grid rows.
 *
 * This table is the byte-for-byte image of the hardcoded checks it replaces:
 * every capability seeded "MANAGER" used to be requireRole("OWNER","MANAGER")
 * at its call sites, every empty list used to be requireOwner(), and the
 * CASHIER grants used to be requireRole("OWNER","MANAGER","CASHIER").
 */
export const DEFAULT_GRID: Record<Capability, RoleEnum[]> = {
  "kasir.access": ["MANAGER", "CASHIER"],
  "kas.access": ["MANAGER", "CASHIER"],
  "settlement.use": ["MANAGER", "CASHIER"],
  "settlement.delete": [],
  "transaksi.write": [],
  "transactions.read": ["MANAGER"],
  "cashregister.read": ["MANAGER"],
  "cashregister.write": [],
  "cashregister.delete": [],
  "dayclose.repost": [],
  "menu.read": ["MANAGER"],
  "menu.write": ["MANAGER"],
  "menu.delete": [],
  "menu.performance": [],
  "suppliers.write": ["MANAGER"],
  "reports.read": ["MANAGER"],
  "admin.ops": ["MANAGER"],
  "attendance.manage": ["MANAGER"],
  "staff.read": ["MANAGER"],
  "staff.write": [],
  "staff.delete": [],
  "settings.write": [],
  "notifications.admin": [],
  "notifications.delete": [],
  "backup.export": [],
  "backup.restore": [],
  "buku.read": [],
  "pengeluaran.write": [],
  "pengeluaran.void": [],
  "buku.akun.write": [],
  "buku.kas.write": [],
  "buku.bulan.write": [],
};

/** The three roles whose grid rows the Owner can toggle. */
export const TOGGLEABLE_ROLES: RoleEnum[] = ["MANAGER", "CASHIER", "STAFF"];

export const ALL_ROLES: RoleEnum[] = ["OWNER", "MANAGER", "CASHIER", "STAFF", "DEVELOPER"];

/**
 * A stored override: one row of the RolePermission table. `allowed: null`
 * means no row exists for this (role, capability) pair.
 */
export type GridOverride = (capability: Capability, role: RoleEnum) => boolean | null;

/** The no-table override used until phase 3 wires the RolePermission table in. */
export const NO_OVERRIDES: GridOverride = () => null;

/**
 * The single decision function every gate reads. Pure by design so the matrix
 * test can exercise it without a database.
 *
 * `strict: true` removes the DEVELOPER superuser bypass — the exact semantics
 * of the requireRoleStrict / requireOwnerStrict variants this layer replaces.
 */
export function isAllowed(
  capability: Capability,
  role: RoleEnum,
  overrides: GridOverride = NO_OVERRIDES,
  options: { strict?: boolean } = {},
): boolean {
  if (role === "OWNER") return true;
  if (role === "DEVELOPER" && !options.strict) return true;
  const stored = overrides(capability, role);
  if (stored !== null) return stored;
  return DEFAULT_GRID[capability].includes(role);
}
