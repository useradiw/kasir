/**
 * laporan-check.mts — READ ONLY. Runs the app's own report builder against the
 * live database and prints the headline lines beside the Warung Books figures
 * taken from scripts/migrasi/warungbooks-reports.json.
 *
 * Writes nothing. Reads DATABASE_URL from .env like any other script here.
 *
 *   npx tsx scripts/migrasi/laporan-check.mts
 */

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", override: false });

import { readFileSync } from "node:fs";
import { buildLaporanKeuangan } from "../../lib/laporan-keuangan";

const MONTHS = ["2026-04", "2026-05", "2026-06", "2026-07"] as const;

const reports = JSON.parse(
  readFileSync(new URL("./warungbooks-reports.json", import.meta.url), "utf8"),
) as Record<string, Record<string, (string | number | null)[][]>>;

/** First numeric cell of the row whose label cell starts with `prefix`. */
function wbFigure(month: string, sheet: string, prefix: string): number | null {
  const rows = reports[month]?.[sheet] ?? [];
  for (const row of rows) {
    const label = String(row[0] ?? "").trim().toLowerCase();
    if (!label.startsWith(prefix.toLowerCase())) continue;
    for (const cell of row.slice(1)) {
      if (typeof cell === "number") return cell;
    }
  }
  return null;
}

const rp = (n: number) => n.toLocaleString("id-ID");

function line(name: string, wb: number | null, kasir: number): string {
  const selisih = wb === null ? null : kasir - wb;
  const flag = selisih === null ? "?" : selisih === 0 ? "COCOK" : "BEDA";
  return [
    name.padEnd(26),
    (wb === null ? "-" : rp(wb)).padStart(14),
    rp(kasir).padStart(14),
    (selisih === null ? "-" : rp(selisih)).padStart(12),
    "  " + flag,
  ].join("");
}

async function main(): Promise<void> {
  for (const month of MONTHS) {
    const l = await buildLaporanKeuangan(month);
    console.log(`\n=== ${month} ===`);
    console.log(
      "baris".padEnd(26) + "Warung Books".padStart(14) + "kasir".padStart(14) + "selisih".padStart(12),
    );
    console.log(line("Total Pendapatan", wbFigure(month, "LABA RUGI", "Total Pendapatan"), l.labaRugi.pendapatan.total));
    console.log(line("Total HPP", wbFigure(month, "LABA RUGI", "Total HPP"), l.labaRugi.hpp.total));
    console.log(line("Laba Kotor", wbFigure(month, "LABA RUGI", "LABA KOTOR"), l.labaRugi.laba_kotor));
    console.log(line("Total Biaya Operasional", wbFigure(month, "LABA RUGI", "Total Biaya Operasional"), l.labaRugi.biaya_operasional.total));
    console.log(line("Laba Bersih", wbFigure(month, "LABA RUGI", "LABA BERSIH"), l.labaRugi.laba_bersih));
    console.log(line("Total Aset", wbFigure(month, "NERACA", "Total Aset"), l.neraca.aset.total));
    console.log(line("Total Ekuitas", wbFigure(month, "NERACA", "Total Ekuitas"), l.neraca.ekuitas.total));

    const seimbang = l.neraca.aset.total === l.neraca.kewajiban.total + l.neraca.ekuitas.total;
    console.log(`  Neraca seimbang: ${seimbang ? "YA" : "TIDAK"}`);
    const gagal = l.validasi.checks.filter((c) => !c.pass);
    console.log(`  Validasi: ${l.validasi.checks.length - gagal.length}/${l.validasi.checks.length} lolos`);
    for (const c of gagal) console.log(`    GAGAL: ${c.name} — ${c.detail}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
