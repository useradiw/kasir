-- Rename the two Laba Rugi expense buckets.
--
--   HPP  -> BAHAN_BAKU    ("Pengeluaran Bahan Baku")
--   OPEX -> OPERASIONAL   ("Pengeluaran Operasional")
--
-- ALTER TYPE ... RENAME VALUE only relabels the enum member. It rewrites no
-- row, touches no money column, and existing rows keep their bucket. The
-- ledger account strings (Expenses:HPP:* / Expenses:OpEx:*) are NOT rewritten
-- here on purpose: the database is reloaded from scratch through the renamed
-- code, so every account name is rebuilt correctly by construction.
ALTER TYPE "ExpenseBucket" RENAME VALUE 'HPP' TO 'BAHAN_BAKU';
ALTER TYPE "ExpenseBucket" RENAME VALUE 'OPEX' TO 'OPERASIONAL';
