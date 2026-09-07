-- 2026-09: RolePermission table — the Owner-editable overlay on the
-- capability grid (lib/permissions.ts). ADDITIVE ONLY. Apply with:
--   prisma db execute --file prisma/sql/2026-09-add-role-permissions.sql
--   prisma migrate resolve --applied 20260907000000_role_permissions
-- Take a backup at /admin/backup first. Verify the printed host is
-- ktcaaasmrryoxinsutzt (the retired project was oyvgyhuzvxepteldlghn).
--
-- The table ships EMPTY, on purpose. It is an override layer, not a copy of
-- the grid: a (role, capability) pair with no row falls back to DEFAULT_GRID
-- in lib/permissions.ts, so an empty table already reproduces day-one
-- behaviour exactly. setPermission() deletes a row whenever its value returns
-- to the default, which keeps the table that way.
--
-- Do NOT add a seed here. Seeding every pair would put stale rows on top of
-- the code and win over it, so a later change to DEFAULT_GRID would silently
-- do nothing. It also would not run: "updatedAt" is NOT NULL with no database
-- default, because Prisma's @updatedAt is applied client-side and never
-- becomes DDL, so a raw INSERT that omits the column is rejected.

BEGIN;

CREATE TABLE "role_permissions" (
    "role"       "RoleEnum" NOT NULL,
    "capability" TEXT NOT NULL,
    "allowed"    BOOLEAN NOT NULL,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role", "capability")
);

COMMIT;
