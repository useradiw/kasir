import { prisma } from "@/lib/prisma";
import type { RoleEnum } from "@/generated/prisma";
import {
  isAllowed,
  NO_OVERRIDES,
  type Capability,
  type GridOverride,
} from "@/lib/permissions";

/**
 * The RolePermission overlay read path.
 *
 * The grid is read on nearly every request, so the rows live in an in-process
 * cache and every gate resolves from memory. Writes go through
 * invalidatePermissionCache() (called by the /buku/izin actions), never by
 * mutating the cache in place.
 *
 * Deploy-order safety: until the DDL lands the table does not exist, and every
 * gate would crash on the read. A missing table is therefore treated as "no
 * overrides" — the hardcoded default grid alone — which is exactly day-one
 * behaviour. That failure is cached briefly so a pre-DDL deploy does not
 * hammer the database on every request; the flag clears on invalidate.
 *
 * Serverless caveat: on Vercel each lambda instance holds its own cache, so a
 * change made on one instance can take a while to reach the others. Acceptable
 * for permission toggles — the next cold start picks them up.
 */

const MISSING_TABLE_TTL_MS = 60_000;
let cached: GridOverride | null = null;
let missingTableUntil = 0;

export function invalidatePermissionCache(): void {
  cached = null;
  missingTableUntil = 0;
}

function rowsToOverride(rows: { role: RoleEnum; capability: string; allowed: boolean }[]): GridOverride {
  const map = new Map<string, boolean>(rows.map((r) => [`${r.role}:${r.capability}`, r.allowed]));
  return (capability: Capability, role: RoleEnum) => map.get(`${role}:${capability}`) ?? null;
}

/** The GridOverride for the stored rows, or NO_OVERRIDES if the table is missing. */
export async function loadPermissionOverride(): Promise<GridOverride> {
  if (cached) return cached;
  if (Date.now() < missingTableUntil) return NO_OVERRIDES;
  try {
    cached = rowsToOverride(await prisma.rolePermission.findMany());
    return cached;
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code?: string }).code === "P2021" // table does not exist
    ) {
      missingTableUntil = Date.now() + MISSING_TABLE_TTL_MS;
      return NO_OVERRIDES;
    }
    throw e;
  }
}

/**
 * The one gate decision the server uses: default grid, overlaid by stored
 * rows. `strict` removes the DEVELOPER bypass (hard deletes).
 */
export async function canByGrid(
  capability: Capability,
  role: RoleEnum,
  options: { strict?: boolean } = {},
  db: Pick<typeof prisma, "rolePermission"> = prisma,
): Promise<boolean> {
  // A caller-supplied client (the pglite tests) bypasses the process cache
  // deliberately — the cache is only ever fed from the production client.
  const override =
    db === prisma ? await loadPermissionOverride() : rowsToOverride(await db.rolePermission.findMany());
  return isAllowed(capability, role, override, options);
}
