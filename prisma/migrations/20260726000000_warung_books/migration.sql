-- Warung Books — the consolidated additive migration for the whole WB ledger
-- (Slices 0-5). Creates ONLY the new WB tables/enums; it does not touch a single
-- pre-existing tokokencana table, so it is safe to apply to a live database.
--
-- Databases that already had this DDL applied by hand (`prisma db execute`)
-- during development must be told it is done instead of re-running it:
--     npx prisma migrate resolve --applied 20260726000000_warung_books
--
-- Note: prisma/migrations/0_init is a dev-snapshot transform and is NOT cleanly
-- deployable to an empty database; that reconcile is still an open task. This
-- migration is written to apply on top of an EXISTING tokokencana database.
--
-- The test harness (test/setup.ts) executes this exact file to build its
-- in-process Postgres, so the suite proves this SQL stays valid and complete.

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "EntryState" AS ENUM ('DRAFT', 'POSTED', 'VOID');

-- CreateEnum
CREATE TYPE "ExpenseBucket" AS ENUM ('HPP', 'OPEX');

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT,
    "type" "AccountType" NOT NULL,
    "parentId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "number" INTEGER,
    "state" "EntryState" NOT NULL DEFAULT 'DRAFT',
    "date" TEXT NOT NULL,
    "narration" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedById" TEXT,
    "sourceType" TEXT,
    "sourceMeta" JSONB,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balance_assertions" (
    "id" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "expected" BIGINT NOT NULL,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "balance_assertions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bucket" "ExpenseBucket" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequences" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_months" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_months_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_channel_accounts" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_channel_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_postings" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_postings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_code_key" ON "ledger_accounts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_name_key" ON "ledger_accounts"("name");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reversedById_key" ON "journal_entries"("reversedById");

-- CreateIndex
CREATE INDEX "balance_assertions_account_date_idx" ON "balance_assertions"("account", "date");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_code_key" ON "expense_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sequences_key_key" ON "sequences"("key");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_months_month_key" ON "accounting_months"("month");

-- CreateIndex
CREATE UNIQUE INDEX "sales_channel_accounts_channel_key" ON "sales_channel_accounts"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_settings_key_key" ON "accounting_settings"("key");

-- CreateIndex
CREATE INDEX "ledger_postings_journalEntryId_idx" ON "ledger_postings"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_postings_sourceType_sourceId_key" ON "ledger_postings"("sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ledger_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
