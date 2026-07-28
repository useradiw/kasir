-- kasir-source-tables.sql — minimal, FK-free stand-ins for the operational
-- kasir tables the Slice 4 sales cross-check reads (Transaction,
-- TableSession, OnlineSettlement). test/setup.ts only applies the Warung
-- Books ledger migration; these tables don't exist in pglite otherwise, and
-- creating real FKs (Staff, etc.) is unnecessary for these tests — only
-- column names/types matter, since getSaleTotals only SELECTs. Applied via
-- createTestClient's `extraSqlFiles` param.
--
-- Column names/types mirror prisma/schema.prisma's Transaction, TableSession
-- and OnlineSettlement models exactly (Prisma quotes identifiers, so casing
-- matters); enum values match the ServiceEnum/PaymentMethod/TransactionStatus
-- Prisma enums.

CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'QRIS', 'SPLIT', 'PENDING');
CREATE TYPE "TransactionStatus" AS ENUM ('PAID', 'VOIDED');
CREATE TYPE "ServiceEnum" AS ENUM ('GoFood', 'ShopeeFood', 'GrabFood', 'Take_Away', 'Unknown');

CREATE TABLE "table_sessions" (
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

CREATE TABLE "transactions" (
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

CREATE TABLE "online_settlements" (
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
