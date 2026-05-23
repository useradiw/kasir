-- AlterEnum
-- Adds the DEVELOPER role. Additive and non-destructive: the new enum value is
-- appended to "RoleEnum" without touching existing rows.
ALTER TYPE "RoleEnum" ADD VALUE 'DEVELOPER';
