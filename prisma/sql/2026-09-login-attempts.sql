-- Login brute-force lockout — additive-only. Creates ONLY the new
-- "login_attempts" table; it does not touch any existing table, so it is
-- safe to apply to a live database.
--
-- Apply with:
--     npx prisma db execute --file prisma/sql/2026-09-login-attempts.sql
--     npx prisma migrate resolve --applied 20260901000000_login_attempts
--
-- Column types and quoting follow the convention set by
-- prisma/migrations/20260726000000_warung_books/migration.sql: TEXT for the
-- id/string columns, INTEGER for counts, TIMESTAMP(3) for Prisma DateTime.

BEGIN;

CREATE TABLE "login_attempts" (
    "username" TEXT NOT NULL,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastFailedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("username")
);

COMMIT;
