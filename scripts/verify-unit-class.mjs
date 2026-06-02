// Sanity-check the unit-class migration on whichever DB DATABASE_URL points to.
import { PrismaClient } from "../generated/prisma/client.js";
const prisma = new PrismaClient();

async function main() {
  const host = (process.env.DATABASE_URL || "").match(/@([^:]+):/)?.[1] ?? "?";
  console.log("DB host:", host);

  const total = await prisma.ingredient.count();
  const missing = await prisma.ingredient.count({ where: { unitClass: undefined } });
  console.log("ingredients total:", total, "| missing unitClass:", missing);

  const dist = await prisma.ingredient.groupBy({
    by: ["unitClass", "unit"],
    _count: { _all: true },
    orderBy: [{ unitClass: "asc" }],
  });
  console.log("\nunitClass × unit:");
  for (const r of dist) console.log(`  ${r.unitClass.padEnd(7)} ${r.unit.padEnd(8)} ${r._count._all}`);

  const settings = await prisma.setting.findMany({
    where: { key: { startsWith: "unit_base_" } },
    orderBy: { key: "asc" },
  });
  console.log("\nunit_base settings:");
  for (const s of settings) console.log(`  ${s.key} = ${s.value}`);

  const supplierCol = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'ingredients' AND column_name IN ('unitClass','defaultSupplierId','tags')
    ORDER BY column_name
  `);
  console.log("\nnew columns:");
  for (const c of supplierCol) console.log(`  ${c.column_name.padEnd(20)} ${c.data_type.padEnd(20)} nullable=${c.is_nullable}`);

  const enumVals = await prisma.$queryRawUnsafe(`
    SELECT enumlabel FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UnitClass')
    ORDER BY enumsortorder
  `);
  console.log("\nUnitClass enum values:", enumVals.map((r) => r.enumlabel).join(", "));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
