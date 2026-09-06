/**
 * run.mts — runner for the REAL database. Adi runs this himself, manually,
 * after reviewing the plan it prints. Claude must never invoke this file.
 *
 * Reads its connection string from MIGRASI_DATABASE_URL ONLY — never
 * DATABASE_URL, never a .env file, never `dotenv`. That is deliberate: this
 * script is meant to be pointed at kasir's real database on purpose, once,
 * by hand, not picked up accidentally by whatever `.env` happens to be
 * loaded in the shell.
 *
 * Without --yes: prints the target host (never credentials) and a summary of
 * the rows about to be loaded, then exits 0 without connecting to anything.
 * With --yes: connects, runs the migration through runMigrasi(), and prints
 * the result summary.
 *
 * Usage (PowerShell):
 *   $env:MIGRASI_DATABASE_URL = "postgres://...";  npx tsx scripts/migrasi/run.mts
 *   $env:MIGRASI_DATABASE_URL = "postgres://...";  npx tsx scripts/migrasi/run.mts --yes
 */

import { readFileSync } from "node:fs";
import { runMigrasi } from "./loader";

// ---------------------------------------------------------------------------
// Same input file locations as loader.ts's defaults — read directly here too
// so the dry-run summary can print row counts without ever importing
// lib/prisma.ts or opening a database connection.
// ---------------------------------------------------------------------------

const EVENTS_PATH = new URL("./warungbooks-events.json", import.meta.url);
const BACKUP_PATH = new URL("../../backup-2026-09-06.json", import.meta.url);

interface WbEventsSummary {
  categories: unknown[];
  ev_capital: unknown[];
  ev_expense: { category_code: string }[];
  ev_transfer: unknown[];
}

interface BackupSummary {
  tables: Record<string, unknown[]>;
}

function printPlan(): void {
  const events = JSON.parse(readFileSync(EVENTS_PATH, "utf8")) as WbEventsSummary;
  const backup = JSON.parse(readFileSync(BACKUP_PATH, "utf8")) as BackupSummary;
  const komisiCount = events.ev_expense.filter((x) => x.category_code === "KOMISI").length;

  console.log("Rencana migrasi (belum menyentuh database apa pun):\n");
  console.log(`  kategori pengeluaran (Warung Books) : ${events.categories.length}`);
  console.log(`  ev_capital                          : ${events.ev_capital.length}`);
  console.log(`  ev_transfer                          : ${events.ev_transfer.length}`);
  console.log(`  ev_expense (total)                  : ${events.ev_expense.length}`);
  console.log(`  ev_expense KOMISI (akan dikecualikan): ${komisiCount}`);
  console.log("");
  console.log("  Tabel operasional dari backup:");
  for (const [table, rows] of Object.entries(backup.tables)) {
    console.log(`    ${table.padEnd(28)}: ${rows.length}`);
  }
  console.log("");
}

function hostOf(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    return url.host;
  } catch {
    return "(tidak bisa mem-parsing URL — periksa MIGRASI_DATABASE_URL)";
  }
}

async function main(): Promise<void> {
  const connectionString = process.env.MIGRASI_DATABASE_URL;
  const args = process.argv.slice(2);
  const confirmed = args.includes("--yes");

  if (!connectionString) {
    console.error(
      "MIGRASI_DATABASE_URL tidak diset. Skrip ini SENGAJA tidak membaca DATABASE_URL atau .env — set variabel " +
        "ini secara eksplisit sebelum menjalankan, supaya tidak pernah menyasar database secara tidak sengaja.\n\n" +
        'PowerShell:\n  $env:MIGRASI_DATABASE_URL = "postgres://user:pass@host:5432/db"\n' +
        "  npx tsx scripts/migrasi/run.mts          # rencana saja, tidak menulis apa pun\n" +
        "  npx tsx scripts/migrasi/run.mts --yes    # benar-benar menulis\n",
    );
    process.exit(1);
  }

  console.log(`Target database: ${hostOf(connectionString)}\n`);
  printPlan();

  if (!confirmed) {
    console.log("Dry run — tidak ada koneksi database yang dibuka, tidak ada yang ditulis. Jalankan lagi dengan --yes untuk benar-benar memigrasi.");
    process.exit(0);
  }

  // Import lazily and only after --yes is confirmed, so a dry run never even
  // loads the pg/Prisma modules that could open a connection.
  const { Pool } = await import("pg");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../../generated/prisma");

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

  console.log("Menjalankan migrasi...\n");
  try {
    const result = await runMigrasi(prisma);

    console.log("=== Jumlah baris yang dimuat ===");
    for (const [label, count] of Object.entries(result.rowCounts)) {
      console.log(`  ${label}: ${count}`);
    }

    console.log("\n=== KOMISI dikecualikan ===");
    console.log(`  ${result.excludedKomisi.count} baris, total Rp ${result.excludedKomisi.total.toLocaleString("id-ID")}`);

    console.log("\n=== Tutup kas harian ===");
    console.log(`  ${result.dayCloseCount} / ${result.dayCloseTotal} hari diposting`);

    console.log("\n=== Pencairan online (settlement) ===");
    for (const s of result.settlements) {
      const adj = s.adjustment === null ? "-" : `penyesuaian Rp ${s.adjustment.toLocaleString("id-ID")}`;
      console.log(`  ${s.date} ${s.service}: ${s.ok ? `OK (${s.journalEntryId}) ${adj}` : `GAGAL — ${s.error}`}`);
    }

    console.log(`\n=== Baris ditolak: ${result.rejections.length} ===`);
    for (const r of result.rejections) {
      console.log(`  [${r.stage}] ${r.error}`);
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
