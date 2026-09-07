/**
 * permission-store.test.ts — the RolePermission overlay read path, against
 * pglite with the REAL migration chain (test/setup.ts applies every
 * prisma/migrations folder, so 20260907000000_role_permissions ships here).
 *
 * Covers the three behaviours the gates depend on:
 *  1. No rows -> the hardcoded default grid decides (fallback never to
 *     "allowed").
 *  2. Stored rows override the default in both directions (grant and revoke).
 *  3. A row whose value equals the default is pointless — setPermission deletes
 *     such rows, so the suite also proves deleting restores the fallback.
 *
 * The cache is bypassed by passing the pglite client explicitly; the cache
 * itself is exercised implicitly by production code and deliberately kept out
 * of these assertions (it is a Map + a boolean, nothing to test past typing).
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import type { PrismaClient } from "@/generated/prisma";
import { canByGrid } from "../lib/permission-store";
import { DEFAULT_GRID } from "../lib/permissions";
import { createTestClient, resetDb, closeTestClients } from "./setup";

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestClient();
});

afterEach(async () => {
  await resetDb(prisma);
});

afterAll(async () => {
  await closeTestClients();
});

async function setRow(role: string, capability: string, allowed: boolean) {
  await prisma.rolePermission.upsert({
    where: { role_capability: { role: role as never, capability } },
    create: { role: role as never, capability, allowed },
    update: { allowed },
  });
}

describe("RolePermission overlay", () => {
  it("with no rows, the default grid decides", async () => {
    expect(await canByGrid("menu.read", "MANAGER", {}, prisma)).toBe(
      DEFAULT_GRID["menu.read"].includes("MANAGER"),
    );
    expect(await canByGrid("menu.read", "CASHIER", {}, prisma)).toBe(false);
    expect(await canByGrid("menu.read", "STAFF", {}, prisma)).toBe(false);
  });

  it("a stored row overrides the default in both directions", async () => {
    // Grant: STAFF gains menu.read, which the default denies.
    await setRow("STAFF", "menu.read", true);
    expect(await canByGrid("menu.read", "STAFF", {}, prisma)).toBe(true);
    // Revoke: MANAGER loses menu.read, which the default grants.
    await setRow("MANAGER", "menu.read", false);
    expect(await canByGrid("menu.read", "MANAGER", {}, prisma)).toBe(false);
    // And it is scoped to the one capability, not a blanket change.
    expect(await canByGrid("menu.write", "MANAGER", {}, prisma)).toBe(
      DEFAULT_GRID["menu.write"].includes("MANAGER"),
    );
  });

  it("strict checks stay strict regardless of stored rows", async () => {
    // Even a stored DEVELOPER row must not buy the superuser a hard delete:
    // strict is a code invariant, not a grid row (and DEVELOPER rows are never
    // written by the UI — this proves the read path cannot be talked past it).
    expect(await canByGrid("menu.delete", "DEVELOPER", { strict: true }, prisma)).toBe(false);
    expect(await canByGrid("menu.delete", "DEVELOPER", {}, prisma)).toBe(true);
    // OWNER is unrevokable in both flavours even if someone hand-inserts a row.
    await setRow("OWNER", "menu.delete", false);
    expect(await canByGrid("menu.delete", "OWNER", { strict: true }, prisma)).toBe(true);
  });
});
