-- Additive indexes for the operational hot paths (redesign build, 2026-08).
-- Transaction had NO indexes at all while every report filters/sorts by paidAt
-- (report-queries.ts, backup exports, day-close posting), and the FK columns
-- used in filters were equally unindexed. Additive only: CREATE INDEX, no
-- drops, no data changes — safe per the prod DDL policy.
--
-- HOW TO APPLY (never `prisma migrate deploy` on this database):
--   1. Take a backup at /admin/backup first.
--   2. prisma db execute --file prisma/sql/2026-08-add-transaction-indexes.sql
--      (verify the printed host is ktcaaasmrryoxinsutzt before running —
--       oyvgyhuzvxepteldlghn, named when this file was written, is RETIRED)
--   3. prisma migrate resolve --applied 20260830000000_add_transaction_indexes
--      after adding the matching migration dir, or simply record it in
--      _prisma_migrations per the HANDOFF procedure.
--
-- Plain CREATE INDEX (not CONCURRENTLY) so it can run inside the reviewed
-- transaction wrapper; at this table size the brief write lock is acceptable.

BEGIN;

CREATE INDEX IF NOT EXISTS transaction_paid_at_idx ON "transactions" ("paidAt");
CREATE INDEX IF NOT EXISTS transaction_table_session_id_idx ON "transactions" ("tableSessionId");
CREATE INDEX IF NOT EXISTS transaction_processed_by_id_idx ON "transactions" ("processedById");
CREATE INDEX IF NOT EXISTS order_item_table_session_id_idx ON "order_items" ("tableSessionId");
CREATE INDEX IF NOT EXISTS table_session_paid_at_idx ON "table_sessions" ("paidAt");

COMMIT;
