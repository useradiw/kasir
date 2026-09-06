/**
 * migrasi-warungbooks.test.ts — MEASUREMENT RUN, not a pass/fail parity test.
 *
 * Loads Toko Kencana's real historical data into an in-process pglite database
 * two ways, via scripts/migrasi/loader.ts's runMigrasi():
 *   1. The operational backup export (backup-2026-09-06.json) — categories,
 *      menu, staff, table sessions, transactions, cash registers, online
 *      settlements, ... — exactly as production had them.
 *   2. The old Warung Books app's bookkeeping events (modal, transfer,
 *      pengeluaran) extracted to scripts/migrasi/warungbooks-events.json.
 *
 * Then it drives kasir's REAL accounting code — ExpenseRepository,
 * CatatRepository, SalesPostingRepository, SettlementPostingRepository,
 * buildLaporanKeuangan — the exact same repositories the /buku screens call,
 * to produce kasir's own monthly financial reports. Those are diffed
 * line-by-line against the reports Warung Books produced for the same months
 * (scripts/migrasi/warungbooks-reports.json), and the diff is written to
 * scripts/migrasi/perbandingan.md.
 *
 * Operational data is capped at 2026-08-31 inclusive (Adi asked for data
 * through 2026-09-06 — backup-2026-09-06.json ends on 2026-09-05).
 * August is still loaded and still day-closed (decision 3/10 in
 * docs/migrasi-data.md) — Adi enters its books himself after migration — but
 * its report is neither generated for comparison nor printed here: only
 * April through July, the four months Adi already has a Warung Books
 * baseline for, are read. August's Neraca is still checked for balance below,
 * since that is a structural invariant unrelated to having a baseline.
 *
 * A "BEDA" (different) sheet is NOT a failing test — it is the finding this
 * file exists to produce. See the DO NOT ASSERT note in the final describe
 * block for exactly what is and is not asserted, and why.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@/generated/prisma";
import { createTestClient } from "./setup";
import { runMigrasi, type MigrasiResult } from "../scripts/migrasi/loader";
import { buildLaporanKeuangan, type LaporanKeuangan } from "../lib/laporan-keuangan";
import { buildLaporanSections, type CsvSection } from "../lib/laporan-csv";

// ---------------------------------------------------------------------------
// Input file locations
// ---------------------------------------------------------------------------

const REPORTS_PATH = new URL("../scripts/migrasi/warungbooks-reports.json", import.meta.url);
const OUTPUT_PATH = new URL("../scripts/migrasi/perbandingan.md", import.meta.url);

/** The months read and printed against a Warung Books baseline (decision 10
 *  in docs/migrasi-data.md) — the four months Adi already has a comparison
 *  for. August is loaded and day-closed by runMigrasi() regardless, but its
 *  report is not generated or printed here. */
const MONTHS = ["2026-04", "2026-05", "2026-06", "2026-07"] as const;

/** Every month a kasir report is built for, so the Neraca-balance assertion
 *  can still cover August: that check is a structural invariant (Aset =
 *  Kewajiban + Ekuitas) unrelated to whether a Warung Books baseline exists,
 *  and August data is still loaded and still day-closed. */
const BALANCE_MONTHS = [...MONTHS, "2026-08"] as const;

/** month "YYYY-MM" -> sheet title -> rows, as the old app rendered them. */
type WbRow = (string | number | null)[];
type WbReports = Record<string, Record<string, WbRow[]>>;

// ---------------------------------------------------------------------------
// Report-line comparison
// ---------------------------------------------------------------------------

interface Line {
  label: string;
  /** The single numeric cell when the row has exactly one data column and
   *  it's a number — the case that gets a real numeric selisih. */
  numeric: number | null;
  /** Human-readable rendering of every data cell, for display and for
   *  non-numeric equality comparison (VALIDASI's Status/Detail columns). */
  display: string;
}

function toLine(row: WbRow): Line {
  const label = String(row[0] ?? "");
  const rest = row.slice(1);
  if (rest.length === 1 && typeof rest[0] === "number") {
    return { label, numeric: rest[0], display: rest[0].toLocaleString("id-ID") };
  }
  const display = rest.map((c) => (c === null || c === undefined ? "" : String(c))).join(" | ");
  return { label, numeric: null, display };
}

function normLabel(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Escape a value for safe placement inside a markdown table cell. */
function cell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

interface SheetDiff {
  matched: { label: string; wb: string; kasir: string; selisih: string; differs: boolean }[];
  wbOnly: Line[];
  kasirOnly: Line[];
  diffCount: number;
}

/**
 * Match WB and kasir lines by normalised label text only — no hand-built
 * alias map between e.g. WB's "Penjualan Tunai" and kasir's "Tunai". That is
 * deliberate: this script measures the gap as it actually is, including
 * cosmetic label differences, rather than deciding in advance which
 * differences "don't count". Where a label repeats on one side (WB's
 * "Kenaikan Kas Bersih" appears twice, once under ARUS KAS and once under
 * REKONSILIASI KAS), the later occurrence wins — both raw file dumps like
 * this one and this comparator make that trade explicit rather than silently
 * dropping the first.
 */
function diffSheet(wbRows: WbRow[], kasirRows: (string | number)[][]): SheetDiff {
  const wbLines = wbRows.filter((r) => typeof r[0] === "string" && r[0].trim() !== "").map(toLine);
  const kasirLines = kasirRows
    .filter((r) => typeof r[0] === "string" && String(r[0]).trim() !== "")
    .map((r) => toLine(r as WbRow));

  const wbMap = new Map(wbLines.map((l) => [normLabel(l.label), l]));
  const kasirMap = new Map(kasirLines.map((l) => [normLabel(l.label), l]));

  const matched: SheetDiff["matched"] = [];
  let diffCount = 0;

  for (const [key, wb] of wbMap) {
    const kasir = kasirMap.get(key);
    if (!kasir) continue;
    let selisih = "-";
    let differs: boolean;
    if (wb.numeric !== null && kasir.numeric !== null) {
      const d = kasir.numeric - wb.numeric;
      selisih = d.toLocaleString("id-ID");
      differs = d !== 0;
    } else {
      differs = wb.display.trim().toLowerCase() !== kasir.display.trim().toLowerCase();
    }
    if (differs) diffCount += 1;
    matched.push({ label: wb.label, wb: wb.display, kasir: kasir.display, selisih, differs });
  }

  const wbOnly = [...wbMap.entries()].filter(([k]) => !kasirMap.has(k)).map(([, l]) => l);
  const kasirOnly = [...kasirMap.entries()].filter(([k]) => !wbMap.has(k)).map(([, l]) => l);
  diffCount += wbOnly.length + kasirOnly.length;

  return { matched, wbOnly, kasirOnly, diffCount };
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

describe("migrasi warungbooks — kasir vs Warung Books measurement run", () => {
  let prisma: PrismaClient;
  let reports: WbReports;
  let migrasi: MigrasiResult;
  let kasirReports: Map<string, LaporanKeuangan>;

  beforeAll(async () => {
    prisma = await createTestClient();

    reports = JSON.parse(readFileSync(REPORTS_PATH, "utf8")) as WbReports;

    // -----------------------------------------------------------------------
    // B–E: books configuration, operational-data load, ev_capital/ev_transfer/
    // ev_expense posting, day-close, and online-settlement posting — all in
    // scripts/migrasi/loader.ts, reused as-is here and by scripts/migrasi/run.mts.
    // -----------------------------------------------------------------------

    migrasi = await runMigrasi(prisma);

    // -----------------------------------------------------------------------
    // F. Build kasir's own reports — for every BALANCE_MONTHS entry so the
    // Neraca-balance assertion can still cover August, even though only
    // MONTHS (April–July) gets compared/printed below.
    // -----------------------------------------------------------------------

    kasirReports = new Map();
    for (const month of BALANCE_MONTHS) {
      kasirReports.set(month, await buildLaporanKeuangan(month, prisma));
    }

    // -----------------------------------------------------------------------
    // G. Compare against Warung Books and write scripts/migrasi/perbandingan.md
    // -----------------------------------------------------------------------

    const SHEET_ORDER = ["LABA RUGI", "NERACA", "PERUBAHAN MODAL", "ARUS KAS", "VALIDASI", "CALK"];
    const KASIR_TITLE: Record<string, string> = { CALK: "CATATAN ATAS LAPORAN KEUANGAN" };

    const allDiffs = new Map<string, Map<string, SheetDiff>>();
    const summaryRows: { month: string; sheet: string; status: string }[] = [];
    /** Months in scope (MONTHS) with no Warung Books report at all. None are
     *  expected now that August (which never had one) is out of scope, but
     *  the branch is kept so an unexpectedly missing baseline is reported
     *  rather than silently skipped. */
    const noBaselineMonths = new Set<string>();

    for (const month of MONTHS) {
      const laporan = kasirReports.get(month)!;
      const sections = buildLaporanSections(laporan);

      if (!(month in reports)) {
        noBaselineMonths.add(month);
        for (const section of sections) {
          summaryRows.push({ month, sheet: section.title, status: "TIDAK ADA BASELINE WB" });
        }
        continue;
      }

      const wbSheets = reports[month];
      const perSheet = new Map<string, SheetDiff>();

      for (const sheetName of SHEET_ORDER) {
        if (!(sheetName in wbSheets)) continue;
        const kasirTitle = KASIR_TITLE[sheetName] ?? sheetName;
        const section: CsvSection | undefined = sections.find((s) => s.title === kasirTitle);
        const diff = diffSheet(wbSheets[sheetName], section ? section.rows : []);
        perSheet.set(sheetName, diff);
        summaryRows.push({
          month,
          sheet: sheetName,
          status: diff.diffCount === 0 ? "MATCH" : `BEDA (${diff.diffCount})`,
        });
      }
      allDiffs.set(month, perSheet);
    }

    console.log("\n=== Ringkasan perbandingan Warung Books vs kasir ===");
    console.log("Bulan\tSheet\tStatus");
    for (const r of summaryRows) console.log(`${r.month}\t${r.sheet}\t${r.status}`);
    console.log("");

    const md: string[] = [];
    md.push("# Perbandingan laporan keuangan: Warung Books vs kasir");
    md.push("");
    md.push(`Dibuat otomatis oleh \`test/migrasi-warungbooks.test.ts\` pada ${new Date().toISOString()}.`);
    md.push("");
    md.push(
      "Ini adalah pengukuran, bukan uji lulus/gagal. Baris dicocokkan dengan label teks yang dinormalisasi " +
        "(dipangkas spasi, huruf kecil semua) — TIDAK ada pemetaan istilah manual antara label Warung Books dan " +
        "label kasir. Akibatnya status BEDA mencampur dua hal yang berbeda maknanya: (1) baris yang cocok labelnya " +
        "tapi angkanya beda — ini kandidat bug nyata — dan (2) baris yang hanya ada di satu sisi karena istilahnya " +
        "berbeda (contoh: Warung Books menulis \"Penjualan Tunai\", kasir menulis \"Tunai\") — ini cuma beda " +
        "penamaan, bukan beda angka. Lihat tabel per-sheet di bawah dan bagian \"Hanya ada di ...\" untuk " +
        "membedakan keduanya. Bila satu label muncul dua kali di sisi Warung Books (mis. \"Kenaikan Kas Bersih\" " +
        "yang tercetak dua kali di ARUS KAS), kemunculan terakhir yang dipakai.",
    );
    md.push("");
    md.push(
      "**Agustus tidak dibaca di sini** — hanya April, Mei, Juni, Juli, empat bulan yang sudah punya baseline " +
        "Warung Books, dibandingkan dan dicetak di bawah. Data Agustus tetap dimuat penuh dan tetap ditutup-kas " +
        "oleh runMigrasi(), dan Neracanya tetap diperiksa tetap seimbang oleh test ini — laporannya saja yang " +
        "belum dibaca; itu urusan Adi setelah migrasi (lihat docs/migrasi-data.md keputusan 10).",
    );
    md.push("");
    md.push("## Ringkasan");
    md.push("");
    md.push("| Bulan | Sheet | Status |");
    md.push("|---|---|---|");
    for (const r of summaryRows) {
      md.push(`| ${r.month} | ${cell(r.sheet)} | ${cell(r.status)} |`);
    }

    for (const month of MONTHS) {
      md.push("");

      if (noBaselineMonths.has(month)) {
        md.push(`## ${month} — TIDAK ADA BASELINE WARUNG BOOKS`);
        md.push("");
        md.push("Tidak ada laporan Warung Books untuk bulan ini, jadi tidak ada perbandingan.");
        continue;
      }

      md.push(`## ${month}`);
      const perSheet = allDiffs.get(month)!;
      for (const [sheetName, diff] of perSheet) {
        md.push("");
        md.push(`### ${sheetName}`);
        md.push("");
        md.push("| Baris | Warung Books | kasir | Selisih |");
        md.push("|---|---|---|---|");
        for (const m of diff.matched) {
          const marker = m.differs ? " **BEDA**" : "";
          md.push(`| ${cell(m.label)}${marker} | ${cell(m.wb)} | ${cell(m.kasir)} | ${cell(m.selisih)} |`);
        }
        if (diff.matched.length === 0) {
          md.push("| _(tidak ada baris yang label-nya cocok di kedua sisi)_ | | | |");
        }

        if (diff.wbOnly.length > 0) {
          md.push("");
          md.push("**Hanya ada di Warung Books (tidak ada padanan label di kasir):**");
          md.push("");
          md.push("| Baris | Warung Books |");
          md.push("|---|---|");
          for (const l of diff.wbOnly) md.push(`| ${cell(l.label)} | ${cell(l.display)} |`);
        }

        if (diff.kasirOnly.length > 0) {
          md.push("");
          md.push("**Hanya ada di kasir (tidak ada padanan label di Warung Books):**");
          md.push("");
          md.push("| Baris | kasir |");
          md.push("|---|---|");
          for (const l of diff.kasirOnly) md.push(`| ${cell(l.label)} | ${cell(l.display)} |`);
        }
      }
    }

    md.push("");
    md.push("## Jumlah baris yang dimuat");
    md.push("");
    md.push("| Tahap | Jumlah |");
    md.push("|---|---|");
    for (const [label, count] of Object.entries(migrasi.rowCounts)) {
      md.push(`| ${cell(label)} | ${count} |`);
    }

    md.push("");
    md.push("## Pengeluaran KOMISI yang dikecualikan");
    md.push("");
    md.push(
      `${migrasi.excludedKomisi.count} baris ev_expense berkategori KOMISI dikecualikan dari posting, total ` +
        `Rp ${migrasi.excludedKomisi.total.toLocaleString("id-ID")} — kasir sudah membukukan komisi online sendiri ` +
        "lewat SettlementPostingRepository ke akun Expenses:Operasional:KomisiOnline, jadi memuat baris KOMISI Warung " +
        "Books juga akan menghitungnya dua kali (docs/migrasi-data.md keputusan 5).",
    );

    md.push("");
    md.push("## Pencairan online (settlement) yang diposting");
    md.push("");
    if (migrasi.settlements.length === 0) {
      md.push("Tidak ada.");
    } else {
      md.push("| Tanggal | Layanan | Penyesuaian selisih | Status | Journal Entry |");
      md.push("|---|---|---|---|---|");
      for (const s of migrasi.settlements) {
        const adj = s.adjustment === null ? "-" : `Rp ${s.adjustment.toLocaleString("id-ID")}`;
        const status = s.ok ? "OK" : `GAGAL: ${s.error}`;
        md.push(`| ${cell(s.date)} | ${cell(s.service)} | ${cell(adj)} | ${cell(status)} | ${cell(s.journalEntryId ?? "-")} |`);
      }
    }

    md.push("");
    md.push("## Baris yang DITOLAK oleh repository");
    md.push("");
    if (migrasi.rejections.length === 0) {
      md.push("Tidak ada — setiap baris yang dicoba berhasil diposting.");
    } else {
      md.push("| Tahap | Input | Error |");
      md.push("|---|---|---|");
      for (const r of migrasi.rejections) {
        md.push(`| ${cell(r.stage)} | ${cell(JSON.stringify(r.input))} | ${cell(r.error)} |`);
      }
    }

    writeFileSync(OUTPUT_PATH, md.join("\n") + "\n", "utf8");
  }, 300_000);

  // ---------------------------------------------------------------------------
  // H. Minimal assertions — enough to prove the run actually completed and the
  // books stayed balanced. Deliberately NOT asserting equality against Warung
  // Books: the whole point of this file is to measure and report the gap, not
  // to pass or fail on it. A BEDA status in perbandingan.md is a finding to
  // read, not a bug to fix here.
  // ---------------------------------------------------------------------------

  it("produced a report for every month in scope", () => {
    for (const month of BALANCE_MONTHS) {
      expect(kasirReports.has(month), `missing report for ${month}`).toBe(true);
      expect(kasirReports.get(month)).toBeDefined();
    }
  });

  it("keeps every month's Neraca balanced: Aset = Kewajiban + Ekuitas", () => {
    for (const month of BALANCE_MONTHS) {
      const laporan = kasirReports.get(month)!;
      const { aset, kewajiban, ekuitas } = laporan.neraca;
      expect(aset.total, `${month}: Aset != Kewajiban + Ekuitas`).toBe(kewajiban.total + ekuitas.total);
    }
  });

  it("excluded exactly the 5 KOMISI ev_expense rows, totalling Rp 105.575", () => {
    expect(migrasi.excludedKomisi.count).toBe(5);
    expect(migrasi.excludedKomisi.total).toBe(105_575);
  });

  it("posted all 5 online settlements successfully", () => {
    expect(migrasi.settlements.length).toBe(5);
    const failed = migrasi.settlements.filter((s) => !s.ok);
    expect(failed, `settlements that failed to post: ${JSON.stringify(failed)}`).toEqual([]);
    expect(migrasi.settlements.filter((s) => s.ok).length).toBe(5);
  });
});
