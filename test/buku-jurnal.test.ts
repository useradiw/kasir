/**
 * buku-jurnal.test.ts — /buku/jurnal rebuild (SPEC #11,
 * docs/redesign/plan-open-items.md section 1, build order 6).
 *
 * Covers the pure total helpers (the money invariant — the Dr total minus
 * the Cr total is 0 and equals entryImbalance) and the client-side filter
 * predicate, following test/buku-pengeluaran.test.ts's shape: pure modules
 * only, nothing from app/actions/** (that reaches production).
 */

import { describe, it, expect } from "vitest";
import {
  entryAmount,
  entryImbalance,
  isBalanced,
  matchesJurnalFilter,
  JURNAL_FILTERS,
} from "../app/buku/jurnal/totals";

describe("entryAmount", () => {
  it("sums the positive (debit) legs of a balanced two-leg entry", () => {
    const lines = [{ amount: 35_000 }, { amount: -35_000 }];
    expect(entryAmount(lines)).toBe(35_000);
  });

  it("sums every positive leg across a multi-leg entry", () => {
    const lines = [{ amount: 200_000 }, { amount: 50_000 }, { amount: -250_000 }];
    expect(entryAmount(lines)).toBe(250_000);
  });

  it("returns 0 for an empty list", () => {
    expect(entryAmount([])).toBe(0);
  });
});

describe("entryImbalance / isBalanced", () => {
  it("is 0 for a balanced two-leg entry", () => {
    const lines = [{ amount: 35_000 }, { amount: -35_000 }];
    expect(entryImbalance(lines)).toBe(0);
    expect(isBalanced(lines)).toBe(true);
  });

  it("is 0 for a balanced multi-leg entry", () => {
    const lines = [{ amount: 200_000 }, { amount: 50_000 }, { amount: -150_000 }, { amount: -100_000 }];
    expect(entryImbalance(lines)).toBe(0);
    expect(isBalanced(lines)).toBe(true);
  });

  it("is non-zero and false for an unbalanced entry", () => {
    const lines = [{ amount: 100_000 }, { amount: -90_000 }];
    expect(entryImbalance(lines)).toBe(10_000);
    expect(isBalanced(lines)).toBe(false);
  });

  it("is 0 for an empty list", () => {
    expect(entryImbalance([])).toBe(0);
    expect(isBalanced([])).toBe(true);
  });

  it("the money invariant: for a balanced entry, Dr total minus Cr total is 0 and equals entryImbalance", () => {
    const lines = [{ amount: 220_000 }, { amount: -220_000 }];
    const drTotal = lines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0);
    const crTotal = lines.filter((l) => l.amount < 0).reduce((s, l) => s + Math.abs(l.amount), 0);
    expect(drTotal - crTotal).toBe(0);
    expect(drTotal - crTotal).toBe(entryImbalance(lines));
  });
});

describe("matchesJurnalFilter", () => {
  const posted = (sourceType: string | null) => ({ sourceType, state: "POSTED" });
  const voided = (sourceType: string | null) => ({ sourceType, state: "VOID" });

  it("semua selects everything regardless of sourceType or state", () => {
    expect(matchesJurnalFilter("semua", posted("shift-close"))).toBe(true);
    expect(matchesJurnalFilter("semua", posted(null))).toBe(true);
    expect(matchesJurnalFilter("semua", voided("pengeluaran"))).toBe(true);
  });

  it("penjualan selects exactly sourceType shift-close", () => {
    expect(matchesJurnalFilter("penjualan", posted("shift-close"))).toBe(true);
    expect(matchesJurnalFilter("penjualan", posted("pengeluaran"))).toBe(false);
    expect(matchesJurnalFilter("penjualan", posted(null))).toBe(false);
  });

  it("belanja selects exactly sourceType pengeluaran", () => {
    expect(matchesJurnalFilter("belanja", posted("pengeluaran"))).toBe(true);
    expect(matchesJurnalFilter("belanja", posted("transfer"))).toBe(false);
  });

  it("kas selects exactly transfer/modal/prive/saldo-awal", () => {
    for (const st of ["transfer", "modal", "prive", "saldo-awal"]) {
      expect(matchesJurnalFilter("kas", posted(st))).toBe(true);
    }
    expect(matchesJurnalFilter("kas", posted("pengeluaran"))).toBe(false);
    expect(matchesJurnalFilter("kas", posted("shift-close"))).toBe(false);
    expect(matchesJurnalFilter("kas", posted(null))).toBe(false);
  });

  it("VOID selects on state, not sourceType — any sourceType, or none, qualifies when voided", () => {
    expect(matchesJurnalFilter("void", voided("pengeluaran"))).toBe(true);
    expect(matchesJurnalFilter("void", voided("shift-close"))).toBe(true);
    expect(matchesJurnalFilter("void", voided(null))).toBe(true);
    expect(matchesJurnalFilter("void", posted("pengeluaran"))).toBe(false);
  });

  it("exposes exactly the five filter chips in mockup order", () => {
    expect(JURNAL_FILTERS).toEqual(["semua", "penjualan", "belanja", "kas", "void"]);
  });
});
