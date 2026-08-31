-- drift-shim.sql — TEST-ONLY objects for the db-push drift in prod's history.
--
-- Prod was partly evolved with `prisma db push`, so several tables and one
-- enum exist in the production database but in NO migration file. Applying
-- the real migration chain on a fresh database therefore fails (migration 2
-- copies FROM expense_templates, ALTERs expense_items/recipe_ingredients/
-- ingredient_logs, and migration 5 ALTER TYPEs StockMovementType). This shim
-- creates exactly those objects — columns mirror schema.prisma's dormant
-- models — BEFORE the chain runs (FKs to later-created tables are omitted; NOT drift itself: it documents the drift.
-- If schema.prisma changes these models, update this file in the same commit.
--
-- This rig applies init + this shim + warung_books only (the COGS-era
-- migrations between them are skipped — see setup.ts). Drift objects those
-- two migrations actually need: table settings (widen/seed refs), enum
-- StockMovementType + table expense_items with cost columns (warung_books
-- laporan reads dormant expense fallbacks), and drift columns on init's
-- expenses table. expense_templates/recipe_ingredients/ingredient_logs are
-- NOT shimmed here — only the COGS-era migrations touch them, and those are
-- skipped.

CREATE TABLE IF NOT EXISTS "settings" (
    "key"       TEXT NOT NULL,
    "value"     TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE', 'SALE', 'ADJUSTMENT', 'WASTE');

CREATE TABLE IF NOT EXISTS "expense_templates" (
    "id"            TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "defaultUnit"   TEXT,
    "defaultCost"   INTEGER,
    "isActive"      BOOLEAN NOT NULL DEFAULT true,
    "currentStock"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lowStockAlert" DOUBLE PRECISION,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expense_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "expense_templates_name_key" ON "expense_templates"("name");

CREATE TABLE IF NOT EXISTS "expense_items" (
    "id"          TEXT NOT NULL,
    "expenseId"   TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount"      DOUBLE PRECISION NOT NULL,
    "cost"        INTEGER NOT NULL,
    "lineTotal"   INTEGER,
    "unit"        TEXT,
    "templateId"  TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expense_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "expense_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "expense_templates"("id") ON DELETE SET NULL
    -- no expenseId FK: "expenses" is created later by init; the chain never
    -- depends on that constraint, and this shim runs first.
);

CREATE TABLE IF NOT EXISTS "recipe_ingredients" (
    "id"         TEXT NOT NULL,
    "recipeId"   TEXT NOT NULL,
    "templateId" TEXT,
    "customName" TEXT,
    "customUnit" TEXT,
    "quantity"   DOUBLE PRECISION NOT NULL,
    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "recipe_ingredients_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "expense_templates"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "ingredient_logs" (
    "id"         TEXT NOT NULL,
    "templateId" TEXT,
    "type"       "StockMovementType" NOT NULL,
    "quantity"   DOUBLE PRECISION NOT NULL,
    "unitCost"   DOUBLE PRECISION NOT NULL,
    "referenceId" TEXT,
    "note"       TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ingredient_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ingredient_logs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "expense_templates"("id") ON DELETE CASCADE
);

-- ─── Drift COLUMNS on init-created tables ─────────────────────────────────────
-- init predates prod's db-push evolution; later migrations read columns prod
-- gained without a migration record. (IF NOT EXISTS keeps this idempotent.)

ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "staffId" TEXT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "supplierId" TEXT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "deductFromCash" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "countToKasPakHar" BOOLEAN NOT NULL DEFAULT false;

-- cash_registers: prod gained opener/closer/editor attribution via db push.
ALTER TABLE "cash_registers" ADD COLUMN IF NOT EXISTS "openedById" TEXT;
ALTER TABLE "cash_registers" ADD COLUMN IF NOT EXISTS "closedById" TEXT;
ALTER TABLE "cash_registers" ADD COLUMN IF NOT EXISTS "editedById" TEXT;
ALTER TABLE "cash_registers" ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3);
ALTER TABLE "cash_registers" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);

-- staff: prod gained the login identity + salary columns via db push. Without
-- them Prisma cannot read or write a single Staff row here, so any test that
-- needs a cashier (revenue, transactions) fails on a column that exists in
-- production and in schema.prisma but in no migration file.
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "supabaseUserId" TEXT;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "salary" INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS "staff_username_key" ON "staff" ("username");
CREATE UNIQUE INDEX IF NOT EXISTS "staff_supabaseUserId_key" ON "staff" ("supabaseUserId");

-- table_sessions / order_items / transactions: the online-order fields, the
-- split-bill fields and the void trail all reached prod by db push.
ALTER TABLE "table_sessions" ADD COLUMN IF NOT EXISTS "externalOrderId" TEXT;
ALTER TABLE "table_sessions" ADD COLUMN IF NOT EXISTS "customerPhone" TEXT;
ALTER TABLE "table_sessions" ADD COLUMN IF NOT EXISTS "erasedAt" TIMESTAMP(3);

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "splitGroup" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "preparedAt" TIMESTAMP(3);
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "servedAt" TIMESTAMP(3);
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "discountAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "splitGroup" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "voidedById" TEXT;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3);
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "voidReason" TEXT;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "cogs" INTEGER;

-- ─── Drift TABLES: the whole online-settlement subsystem ─────────────────────
-- online_settlements and settlement_items exist in production and in
-- schema.prisma but in NO migration file — they were created with db push.
-- Recorded in docs/migration-audit.md; the chain cannot rebuild prod without
-- them, and pencairan is money, so the tests need them.
CREATE TABLE IF NOT EXISTS "online_settlements" (
    "id"               TEXT NOT NULL,
    "service"          "ServiceEnum" NOT NULL,
    "settlementDate"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalGross"       INTEGER NOT NULL,
    "commissionAmount" INTEGER NOT NULL,
    "finalAmount"      INTEGER NOT NULL,
    "settledById"      TEXT NOT NULL,
    "notes"            TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "online_settlements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "online_settlements_settledById_fkey" FOREIGN KEY ("settledById") REFERENCES "staff"("id")
);

CREATE TABLE IF NOT EXISTS "settlement_items" (
    "id"            TEXT NOT NULL,
    "settlementId"  TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    CONSTRAINT "settlement_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "settlement_items_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "online_settlements"("id") ON DELETE CASCADE,
    CONSTRAINT "settlement_items_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "settlement_items_transactionId_key" ON "settlement_items" ("transactionId");

CREATE TABLE IF NOT EXISTS "settlement_deductions" (
    "id"           TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "label"        TEXT NOT NULL,
    "amount"       INTEGER NOT NULL,
    CONSTRAINT "settlement_deductions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "settlement_deductions_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "online_settlements"("id") ON DELETE CASCADE
);

-- Nullability drift: init made table_sessions.ownerId mandatory; prod relaxed
-- it (a session can outlive the staff row that opened it), and schema.prisma
-- declares `ownerId String?`.
ALTER TABLE "table_sessions" ALTER COLUMN "ownerId" DROP NOT NULL;

-- Enum drift: init's PaymentMethod is ('CASH','DYNAMIC_QRIS','STATIC_QRIS').
-- Prod was reshaped by db push to what schema.prisma declares today, so a
-- database built from the migration chain alone cannot store a single modern
-- payment. The old values are left in place — harmless, and dropping an enum
-- value is not something to practise here.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'QRIS';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'SPLIT';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'PENDING';
