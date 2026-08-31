-- kasir-source-tables.sql — drift top-up for the OPERATIONAL kasir tables.
--
-- test/setup.ts applies the REAL migration chain (init → drift-shim →
-- warung_books), so transactions/table_sessions already exist here — but
-- init predates prod's db-push evolution, and online_settlements never had a
-- migration at all. This file is written to be IDEMPOTENT over the chain:
--   * enums and tables use IF NOT EXISTS / duplicate guards,
--   * columns prod gained via db push are added with ADD COLUMN IF NOT EXISTS,
--   * init's NOT NULL ownerId on table_sessions is relaxed to match schema.
-- The column lists mirror prisma/schema.prisma exactly (Prisma quotes
-- identifiers, so casing matters); enum values match the ServiceEnum /
-- PaymentMethod / TransactionStatus Prisma enums.

DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'QRIS', 'SPLIT', 'PENDING');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "TransactionStatus" AS ENUM ('PAID', 'VOIDED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ServiceEnum" AS ENUM ('GoFood', 'ShopeeFood', 'GrabFood', 'Take_Away', 'Unknown');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "table_sessions" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "service" "ServiceEnum",
  "externalOrderId" TEXT,
  "customerAlias" TEXT,
  "customerPhone" TEXT,
  "ownerId" TEXT,
  "orderedAt" TIMESTAMP(3),
  "servedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "erasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "transactions" (
  "id" TEXT PRIMARY KEY,
  "tableSessionId" TEXT NOT NULL,
  "processedById" TEXT NOT NULL,
  "subtotal" INTEGER NOT NULL DEFAULT 0,
  "taxAmount" INTEGER NOT NULL DEFAULT 0,
  "serviceCharge" INTEGER NOT NULL DEFAULT 0,
  "discountAmount" INTEGER NOT NULL DEFAULT 0,
  "totalAmount" INTEGER NOT NULL,
  "cashAmount" INTEGER NOT NULL DEFAULT 0,
  "qrisAmount" INTEGER NOT NULL DEFAULT 0,
  "paymentMethod" "PaymentMethod" NOT NULL,
  "splitGroup" INTEGER NOT NULL DEFAULT 0,
  "status" "TransactionStatus" NOT NULL DEFAULT 'PAID',
  "voidedById" TEXT,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "cogs" INTEGER
);

CREATE TABLE IF NOT EXISTS "online_settlements" (
  "id" TEXT PRIMARY KEY,
  "service" "ServiceEnum" NOT NULL,
  "settlementDate" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "totalGross" INTEGER NOT NULL,
  "commissionAmount" INTEGER NOT NULL,
  "finalAmount" INTEGER NOT NULL,
  "settledById" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- Drift columns on the init-created tables (prod gained them via db push).
ALTER TABLE "table_sessions" ADD COLUMN IF NOT EXISTS "externalOrderId" TEXT;
ALTER TABLE "table_sessions" ADD COLUMN IF NOT EXISTS "customerPhone" TEXT;
ALTER TABLE "table_sessions" ADD COLUMN IF NOT EXISTS "erasedAt" TIMESTAMP(3);
ALTER TABLE "table_sessions" ALTER COLUMN "ownerId" DROP NOT NULL;

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "discountAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "splitGroup" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "voidedById" TEXT;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3);
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "voidReason" TEXT;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "cogs" INTEGER;

ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "supabaseUserId" TEXT;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "salary" INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS "staff_username_key" ON "staff"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "staff_supabaseUserId_key" ON "staff"("supabaseUserId");
