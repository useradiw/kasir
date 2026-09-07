-- RolePermission: the Owner-editable overlay on the capability grid.
-- See lib/permissions.ts. OWNER and DEVELOPER are never stored here.
CREATE TABLE "role_permissions" (
    "role"       "RoleEnum" NOT NULL,
    "capability" TEXT NOT NULL,
    "allowed"    BOOLEAN NOT NULL,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role", "capability")
);
