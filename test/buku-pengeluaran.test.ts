/**
 * buku-pengeluaran.test.ts — /buku/pengeluaran rebuild (SPEC #13,
 * docs/redesign/plan-open-items.md section 1, build order 5).
 *
 * Covers: the pure total helpers (the money invariant — a column of figures
 * must add up to the total shown against it), getCashAccountBalances against
 * pglite (task C), and a source-text guard for the deliberate requireAuth()
 * exception on app/buku/belanja/page.tsx (task B).
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@/generated/prisma";
import { computeLineJumlah, sumJumlah } from "../app/buku/pengeluaran/totals";
import { getCashAccountBalances } from "../lib/ledger-queries";
import { AccountingRepository } from "../lib/accounting/accountingRepository";
import { createTestClient, resetDb } from "./setup";

// ---------------------------------------------------------------------------
// computeLineJumlah / sumJumlah — pure, no DB
// ---------------------------------------------------------------------------

describe("computeLineJumlah", () => {
  it("rounds qty x hargaSatuan to the nearest whole Rupiah", () => {
    expect(computeLineJumlah(2, 110_000)).toBe(220_000);
  });

  it("handles a decimal quantity like 2.5", () => {
    expect(computeLineJumlah(2.5, 110_000)).toBe(275_000);
  });

  it("rounds a fractional result to the nearest whole Rupiah", () => {
    expect(computeLineJumlah(1.333, 100)).toBe(133);
  });

  it("returns 0 for a zero quantity or zero price", () => {
    expect(computeLineJumlah(0, 110_000)).toBe(0);
    expect(computeLineJumlah(2, 0)).toBe(0);
  });

  it("treats non-finite input (NaN, Infinity) as 0", () => {
    expect(computeLineJumlah(NaN, 100)).toBe(0);
    expect(computeLineJumlah(2, NaN)).toBe(0);
    expect(computeLineJumlah(Infinity, 100)).toBe(0);
  });
});

describe("sumJumlah", () => {
  it("sums a list of line amounts to the displayed total — the money invariant", () => {
    const lines = [{ jumlah: 220_000 }, { jumlah: 55_000 }, { jumlah: 12_500 }];
    expect(sumJumlah(lines)).toBe(287_500);
  });

  it("returns 0 for an empty list", () => {
    expect(sumJumlah([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getCashAccountBalances — against pglite (task C)
// ---------------------------------------------------------------------------

describe("getCashAccountBalances", () => {
  let prisma: PrismaClient;
  let acc: AccountingRepository;

  const LACI = "Assets:Cash:Laci";
  const BANK = "Assets:Cash:BankBCA";

  beforeAll(async () => {
    prisma = await createTestClient();
    acc = new AccountingRepository(prisma);
  });

  afterEach(async () => {
    await resetDb(prisma);
  });

  it("sums JournalLine.amount per Assets:Cash:* account across several accounts", async () => {
    await acc.postEntry({
      date: "2026-07-05",
      narration: "Saldo awal Laci",
      lines: [
        { account: LACI, amount: 300_000n },
        { account: "Equity:SaldoAwal", amount: -300_000n },
      ],
    });
    await acc.postEntry({
      date: "2026-07-06",
      narration: "Saldo awal BCA",
      lines: [
        { account: BANK, amount: 1_000_000n },
        { account: "Equity:SaldoAwal", amount: -1_000_000n },
      ],
    });
    await acc.postEntry({
      date: "2026-07-07",
      narration: "Transfer Laci -> BCA",
      lines: [
        { account: BANK, amount: 100_000n },
        { account: LACI, amount: -100_000n },
      ],
    });

    const balances = await getCashAccountBalances({}, prisma);
    expect(balances[LACI]).toBe(200_000);
    expect(balances[BANK]).toBe(1_100_000);
    // Never counts a non-cash account.
    expect(balances["Equity:SaldoAwal"]).toBeUndefined();
  });

  it("bounds the sum with dateTo (inclusive)", async () => {
    await acc.postEntry({
      date: "2026-07-01",
      narration: "Dalam rentang",
      lines: [
        { account: LACI, amount: 100_000n },
        { account: "Equity:SaldoAwal", amount: -100_000n },
      ],
    });
    await acc.postEntry({
      date: "2026-07-15",
      narration: "Sesudah dateTo",
      lines: [
        { account: LACI, amount: 50_000n },
        { account: "Equity:SaldoAwal", amount: -50_000n },
      ],
    });

    const balances = await getCashAccountBalances({ dateTo: "2026-07-01" }, prisma);
    expect(balances[LACI]).toBe(100_000);
  });

  it("includes a VOIDED entry and its reversal, netting to zero", async () => {
    const entry = await acc.postEntry({
      date: "2026-07-05",
      narration: "Pengeluaran yang di-void",
      lines: [
        { account: "Expenses:Operasional:Test", amount: 50_000n },
        { account: LACI, amount: -50_000n },
      ],
    });
    await acc.voidEntry(entry.id);

    // The voided entry's two lines plus its reversal's two lines must net to
    // zero on the cash account — excluding VOID would strand the reversal
    // and report a balance that never existed.
    const balances = await getCashAccountBalances({}, prisma);
    expect(balances[LACI] ?? 0).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Guard: app/buku/belanja/page.tsx is the ONLY /buku page gated with
// requireAuth() instead of a buku capability. This must fail if someone "fixes"
// the gate to requireCan("buku.read"), or adds a new ungated /buku page.
// ---------------------------------------------------------------------------

describe("buku page auth-gate guard", () => {
  const APP_BUKU_DIR = path.resolve(__dirname, "../app/buku");

  function findPageFiles(dir: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        found.push(...findPageFiles(full));
      } else if (entry.name === "page.tsx") {
        found.push(full);
      }
    }
    return found;
  }

  // Match the actual call (`await requireX(`), not prose mentioning the other
  // gate by name — the why-comment on this page deliberately says
  // "requireOwner()" in the text explaining what NOT to do.
  it("app/buku/belanja/page.tsx calls requireAuth(), not the buku capability", () => {
    const source = readFileSync(path.join(APP_BUKU_DIR, "belanja/page.tsx"), "utf8");
    expect(source).toMatch(/await requireAuth\(/);
    expect(source).not.toMatch(/await requireCan\(/);
  });

  // The requireAuth() gate above is worthless on its own: the page also has to
  // READ without owner rights. It shipped calling listCategories() and
  // listCashAccounts() from app/actions/admin/queries, whose exports are thin
  // requireOwner() wrappers, so every cashier was redirected to /beranda and
  // the page was unreachable for the only role it exists for. The gate test
  // above passed the whole time — it checked a proxy, not the thing that
  // failed. Found in UAT 2026-09-03. Read the lib repositories directly here.
  it("app/buku/belanja/page.tsx does not read through the requireCan query wrappers", () => {
    const source = readFileSync(path.join(APP_BUKU_DIR, "belanja/page.tsx"), "utf8");
    expect(source).not.toMatch(/from\s+["']@\/app\/actions\/admin\/queries/);
  });

  it("every other app/buku/**/page.tsx calls requireCan(\"buku.read\")", () => {
    const pages = findPageFiles(APP_BUKU_DIR).filter(
      (p) => path.relative(APP_BUKU_DIR, p) !== path.join("belanja", "page.tsx"),
    );
    expect(pages.length).toBeGreaterThan(0);
    for (const file of pages) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} must call requireCan("buku.read")`).toMatch(
        /await requireCan\("buku\.read"\)/,
      );
    }
  });
});
