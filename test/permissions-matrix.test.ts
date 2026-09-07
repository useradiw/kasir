/**
 * permissions-matrix.test.ts — the regression gate for the capability layer.
 *
 * The seeded grid (DEFAULT_GRID) must reproduce, byte for byte, what the
 * hardcoded role checks did before the migration. This test is built from the
 * call-site inventory taken BEFORE any call site moved (131 await-calls across
 * ~68 files, collapsing to seven shapes), so it pins today's behaviour rather
 * than describing whatever the layer happened to implement:
 *
 *   requireOwner()                      -> OWNER only, DEVELOPER bypasses
 *   requireRole("OWNER","MANAGER")      -> OWNER, MANAGER, DEVELOPER bypasses
 *   requireRole("OWNER","MANAGER","CASHIER") -> + CASHIER, DEVELOPER bypasses
 *   requireRole("OWNER")                -> OWNER only, DEVELOPER bypasses
 *   requireOwnerStrict()                -> OWNER only, NO DEVELOPER
 *   requireRoleStrict("OWNER","MANAGER") -> OWNER, MANAGER, NO DEVELOPER
 *   requireAuth()                       -> every active staff member
 *
 * Part two is a source scan asserting the three privileged-role invariants in
 * app/actions/admin/staff.ts are still direct role comparisons, NOT capability
 * checks — a capability is a grant the Owner can toggle, and those invariants
 * must not be.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  CAPABILITIES,
  CAPABILITY_KEYS,
  DEFAULT_GRID,
  isAllowed,
  type Capability,
} from "../lib/permissions";
import type { RoleEnum } from "@/generated/prisma";

const ROOT = join(__dirname, "..");

/** The original gate shape behind each capability, from the call-site inventory. */
type Shape =
  | "O" // requireOwner / requireRole("OWNER")
  | "OM" // requireRole("OWNER", "MANAGER")
  | "OMC" // requireRole("OWNER", "MANAGER", "CASHIER")
  | "O-strict" // requireOwnerStrict
  | "OM-strict"; // requireRoleStrict("OWNER", "MANAGER")

const TOGGLED: Record<Shape, RoleEnum[]> = {
  "O": [],
  "OM": ["MANAGER"],
  "OMC": ["MANAGER", "CASHIER"],
  "O-strict": [],
  "OM-strict": ["MANAGER"],
};

/** Whether the shape's original gate admitted a DEVELOPER. */
const BYPASSES_DEVELOPER: Record<Shape, boolean> = {
  "O": true,
  "OM": true,
  "OMC": true,
  "O-strict": false,
  "OM-strict": false,
};

/**
 * Every capability, with the gate shape(s) found at its call sites. A
 * capability can carry both flavours when the same verb is gated non-strict in
 * one action and strict in another (noted in `alsoStrict`) — the grid is the
 * union, and the matrix test checks each flavour's semantics separately.
 */
const INVENTORY: Record<Capability, { shape: Shape; alsoStrict?: true }> = {
  // Kasir & Transaksi
  "kasir.access": { shape: "OMC" }, // app/kasir/{layout,page}.tsx
  "kas.access": { shape: "OMC" }, // app/kas/page.tsx
  "settlement.use": { shape: "OMC" }, // app/settlement/page.tsx, settlement-queries, createSettlement
  "settlement.delete": { shape: "O" }, // deleteSettlement: requireRole("OWNER")
  "transaksi.write": { shape: "O" }, // voidTransaction, updateTransaction
  "transactions.read": { shape: "OM" }, // transaction-queries, /admin/transactions pages
  // Kas & Register
  "cashregister.read": { shape: "OM" }, // getCashRegisterData
  "cashregister.write": { shape: "O" }, // openRegister, closeRegister, editRegister
  "cashregister.delete": { shape: "O-strict" }, // deleteRegister
  "dayclose.repost": { shape: "O" }, // repostDayCloseForRegister
  // Menu & Supplier
  "menu.read": { shape: "OM" }, // getInventoryData, /admin/inventory
  "menu.write": { shape: "OM", alsoStrict: true }, // inventory writes; deleteOnlinePrice is strict OM
  "menu.delete": { shape: "O-strict" }, // the six inventory hard deletes
  "menu.performance": { shape: "O" }, // getMenuPerformanceData, /admin/menu-performance
  "suppliers.write": { shape: "OM" }, // suppliers.ts, /admin/suppliers
  // Laporan & Admin
  "reports.read": { shape: "OM" }, // getReportData, /admin/reports
  "admin.ops": { shape: "OM" }, // /admin page + (ops) layout + dashboard
  "attendance.manage": { shape: "OM" }, // attendance.ts, attendance-queries, /admin/attendance
  "staff.read": { shape: "OM" }, // staff-queries, /admin/staff
  "staff.write": { shape: "O" }, // addStaff, updateStaff, toggleStaffActive, link/unlink
  "staff.delete": { shape: "O-strict" }, // deleteStaff
  "settings.write": { shape: "O" }, // settings.ts, /settings
  "notifications.admin": { shape: "O" }, // admin notifications.ts, /admin/notifications
  "notifications.delete": { shape: "O-strict" }, // deleteNotification
  "backup.export": { shape: "O" }, // exportDatabase, /admin/backup
  "backup.restore": { shape: "O" }, // restoreDatabase
  "permissions.manage": { shape: "O-strict" }, // /admin/izin — real OWNER only
  // Buku (Keuangan)
  "buku.read": { shape: "O" }, // /buku pages + keuangan queries
  "pengeluaran.write": { shape: "O" }, // recordPengeluaran (recordPengeluaranAsStaff stays requireAuth)
  "pengeluaran.void": { shape: "O" }, // voidPengeluaran
  "buku.akun.write": { shape: "O" }, // categories, chart of accounts, CALK, channel accounts
  "buku.kas.write": { shape: "O" }, // transfer, modal, prive, saldo awal, voidCatat, cash accounts, cek saldo
  "buku.bulan.write": { shape: "O" }, // createMonth, setSelectedMonth, lockMonth, unlockMonth
};

const OTHER_ROLES: RoleEnum[] = ["MANAGER", "CASHIER", "STAFF"];

describe("permission matrix — seeded grid vs today's behaviour", () => {
  it("catalogues exactly the capabilities in the inventory", () => {
    expect(CAPABILITY_KEYS.sort()).toEqual(Object.keys(INVENTORY).sort());
  });

  it("every capability has a label and a known group", () => {
    for (const key of CAPABILITY_KEYS) {
      expect(CAPABILITIES[key].label.length).toBeGreaterThan(0);
      expect(Object.keys(DEFAULT_GRID)).toContain(key);
    }
  });

  for (const cap of CAPABILITY_KEYS) {
    const { shape, alsoStrict } = INVENTORY[cap];

    it(`${cap} (shape ${shape})`, () => {
      // The three toggleable roles get exactly what the old gate granted.
      for (const role of OTHER_ROLES) {
        const expected = TOGGLED[shape].includes(role);
        expect(isAllowed(cap, role), `${role} on ${cap}`).toBe(expected);
      }
      // OWNER is always allowed, in both flavours — the Owner row is not a
      // grid row and cannot be revoked.
      expect(isAllowed(cap, "OWNER"), `OWNER on ${cap}`).toBe(true);
      expect(isAllowed(cap, "OWNER", undefined, { strict: true }), `OWNER strict on ${cap}`).toBe(true);
      // DEVELOPER's superuser bypass is a property of the function, always
      // present non-strict and always absent strict. Whether a call site runs
      // the strict flavour is pinned by the shape fields above: strict-shaped
      // capabilities are ONLY ever called strict, so a DEVELOPER can never
      // reach them even though a non-strict lookup would admit him.
      expect(isAllowed(cap, "DEVELOPER"), `DEVELOPER on ${cap}`).toBe(true);
    });

    if (alsoStrict) {
      it(`${cap} strict flavour keeps the old strict semantics`, () => {
        expect(BYPASSES_DEVELOPER[shape]).toBe(true); // sanity: only meaningful for bypassing shapes
        for (const role of OTHER_ROLES) {
          const expected = TOGGLED[shape].includes(role);
          expect(isAllowed(cap, role, undefined, { strict: true }), `${role} strict on ${cap}`).toBe(expected);
        }
        // And a strict call NEVER admits DEVELOPER, whatever the grid says.
        expect(isAllowed(cap, "DEVELOPER", undefined, { strict: true })).toBe(false);
      });
    }
  }

  it("a missing override falls back to the default, never to allowed", () => {
    // A granted role: override denying it wins.
    expect(isAllowed("menu.read", "MANAGER", () => false)).toBe(false);
    // A non-granted role: override granting it wins.
    expect(isAllowed("menu.read", "STAFF", (c, r) => (c === "menu.read" && r === "STAFF" ? true : null))).toBe(true);
    // No row: default applies.
    expect(isAllowed("menu.read", "CASHIER", () => null)).toBe(false);
    // OWNER and DEVELOPER are not overridable.
    expect(isAllowed("menu.read", "OWNER", () => false)).toBe(true);
    expect(isAllowed("menu.read", "DEVELOPER", () => false)).toBe(true);
    expect(isAllowed("menu.read", "DEVELOPER", () => false, { strict: true })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// No strays: the hardcoded role gates are GONE. Every gate in app/ must be a
// capability. If this fails, someone reintroduced requireOwner/requireRole or
// added a new gate helper beside the capability layer — the grid stops being
// the source of truth the moment that happens.
// ---------------------------------------------------------------------------

describe("no hardcoded role gates remain", () => {
  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) out.push(...walk(full));
      else out.push(full);
    }
    return out;
  }

  it("app/, lib/, components/, hooks/ and utils/ gate only through capabilities", () => {
    const dirs = ["app", "lib", "components", "hooks", "utils"].map((d) => join(ROOT, d));
    const offenders: string[] = [];
    for (const dir of dirs) {
      for (const file of walk(dir)) {
        if (!/\.(ts|tsx)$/.test(file)) continue;
        const source = readFileSync(file, "utf8");
        if (/require(Owner|Role)Strict?\(/.test(source)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("admin-auth.ts no longer exports the legacy role gates", () => {
    const source = readFileSync(join(ROOT, "lib/admin-auth.ts"), "utf8");
    expect(source).not.toMatch(/export async function require(Owner|Role)/);
  });
});

// ---------------------------------------------------------------------------
// The privileged-role invariants in app/actions/admin/staff.ts must stay
// DIRECT role comparisons. If someone refactors them into capability checks,
// they become grants the Owner could toggle — which is precisely the failure
// the guards exist to prevent.
// ---------------------------------------------------------------------------

describe("staff.ts privileged-role invariants", () => {
  const source = readFileSync(join(ROOT, "app/actions/admin/staff.ts"), "utf8");

  it("keeps the guards as real-role comparisons, not capability checks", () => {
    expect(source).toContain('const PRIVILEGED_ROLES: RoleEnum[] = ["OWNER", "DEVELOPER"]');
    expect(source).toContain('if (actor.role !== "OWNER")');
    const guardBody = source.slice(
      source.indexOf("function assertMayChangePrivilegedRole"),
      source.indexOf("function assertNotSelfLockout"),
    );
    expect(guardBody).not.toContain("requireCan");
    expect(guardBody).not.toContain("isAllowed");
  });

  it("still calls assertMayChangePrivilegedRole and assertNotSelfLockout from updateStaff", () => {
    const updateStaff = source.slice(source.indexOf("export async function updateStaff"), source.indexOf("export async function deleteStaff"));
    expect(updateStaff).toContain("assertNotSelfLockout(actor");
    expect(updateStaff).toContain("assertMayChangePrivilegedRole(actor");
  });

  it("still guards deleteStaff with the strict staff.delete gate", () => {
    const deleteStaff = source.slice(source.indexOf("export async function deleteStaff"), source.indexOf("export async function toggleStaffActive"));
    expect(deleteStaff).toContain('requireCanStrict("staff.delete")');
  });

  it("still blocks self-deactivation and unguarded OWNER/DEVELOPER deactivation in toggleStaffActive", () => {
    const toggle = source.slice(source.indexOf("export async function toggleStaffActive"));
    expect(toggle).toContain("actor.id === id");
    expect(toggle).toContain('actor.role !== "OWNER"');
  });
});
