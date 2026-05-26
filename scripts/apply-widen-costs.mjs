// Applies migration 20260527000000_widen_costs_to_float by executing its SQL
// directly via Prisma's $executeRawUnsafe. Sidesteps `prisma migrate deploy`
// drift (prod was evolved with db push; migrations don't replay cleanly).
//
// Usage:
//   DATABASE_URL=<direct, :5432> DIRECT_URL=<same> node scripts/apply-widen-costs.mjs
//
// Prints the resolved DB host before doing anything so you can sanity-check.
// Idempotent: ALTER ... TYPE DOUBLE PRECISION is a no-op if the column is
// already double precision.

import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

const STATEMENTS = [
  `ALTER TABLE "ingredients"
     ALTER COLUMN "averageUnitCost" TYPE DOUBLE PRECISION USING "averageUnitCost"::double precision,
     ALTER COLUMN "lastUnitCost"    TYPE DOUBLE PRECISION USING "lastUnitCost"::double precision`,
  `ALTER TABLE "ingredient_purchases"
     ALTER COLUMN "unitCost"         TYPE DOUBLE PRECISION USING "unitCost"::double precision,
     ALTER COLUMN "avgUnitCostAfter" TYPE DOUBLE PRECISION USING "avgUnitCostAfter"::double precision`,
  `ALTER TABLE "ingredient_logs"
     ALTER COLUMN "unitCost" TYPE DOUBLE PRECISION USING "unitCost"::double precision`,
  `UPDATE "settings" SET "value" = 'g' WHERE "key" = 'unit_base_weight' AND "value" = 'mg'`,
];

async function showTypes(label) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE (table_name, column_name) IN (
      ('ingredients', 'averageUnitCost'),
      ('ingredients', 'lastUnitCost'),
      ('ingredient_purchases', 'unitCost'),
      ('ingredient_purchases', 'avgUnitCostAfter'),
      ('ingredient_logs', 'unitCost')
    )
    ORDER BY table_name, column_name
  `);
  console.log(`\n${label}:`);
  for (const r of rows) console.log(`  ${r.table_name}.${r.column_name.padEnd(20)} ${r.data_type}`);
  const setting = await prisma.setting.findUnique({ where: { key: "unit_base_weight" } });
  console.log(`  setting unit_base_weight = ${setting?.value ?? "<missing>"}`);
}

async function main() {
  const host = (process.env.DATABASE_URL || "").match(/@([^:/]+)/)?.[1] ?? "?";
  const isDev  = host.includes("ap-northeast-2");
  const isProd = host.includes("ap-southeast-1");
  console.log(`DB host: ${host}  (${isProd ? "PROD" : isDev ? "DEV" : "UNKNOWN"})`);
  if (!isDev && !isProd) {
    console.error(`Refusing to run: host is neither dev (ap-northeast-2) nor prod (ap-southeast-1). Set DATABASE_URL inline.`);
    process.exit(1);
  }

  await showTypes("BEFORE");

  for (const sql of STATEMENTS) {
    console.log(`\n→ ${sql.split("\n")[0]}...`);
    const n = await prisma.$executeRawUnsafe(sql);
    console.log(`  rows affected (or 0 for DDL): ${n}`);
  }

  await showTypes("AFTER");
  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
