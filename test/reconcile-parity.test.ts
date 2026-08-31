import { describe, it, expect } from "vitest";
import { reconcileRegisterDay } from "@/app/actions/admin/queries/_shared";
import { sumDaySales, type DaySalesInput } from "@/lib/day-close";

/**
 * PARITY SUITE — kas harian expected-cash, old formula vs new.
 *
 * The pre-branch calculation (git show master:app/actions/admin/queries/
 * _shared.ts and cash-register-queries.ts) was:
 *
 *   cashIncome    = sum(totalAmount) of PAID transactions with paymentMethod CASH
 *   totalExpenses = sum(computeExpenseTotal(items)) of Expense rows with deductFromCash
 *   expectedClosing = openingCash + cashIncome - totalExpenses
 *
 * This branch replaced the Expense read with the ledger and the CASH filter
 * with sumDaySales. Adi's bar: the numbers that were right must stay right.
 * So every case below runs BOTH formulas over the same day and either proves
 * they agree, or names the reason they must not.
 */

// The old implementation, transcribed from master so the comparison is real
// and not a paraphrase of it.
function masterReconcile(
  r: { openingCash: number; closingCash: number | null },
  day: { cashIncome: number; totalExpenses: number },
) {
  const expectedClosing = r.openingCash + day.cashIncome - day.totalExpenses;
  return {
    expectedClosing,
    difference: r.closingCash !== null ? r.closingCash - expectedClosing : null,
  };
}

/** Master's cash income: CASH transactions only, counted at their bill total. */
function masterCashIncome(txs: DaySalesInput[]): number {
  return txs
    .filter((t) => t.paymentMethod === "CASH")
    .reduce((sum, t) => sum + t.totalAmount, 0);
}

const DAY = new Date(2026, 7, 30);

/** The new formula, expressed the way the screens call it. */
function current(
  r: { openingCash: number; closingCash: number | null },
  day: { cashSales: number; qrisSales?: number; nonSalesCashMovement: number },
) {
  const key = "2026-08-30";
  return reconcileRegisterDay(
    { ...r, date: DAY },
    {
      cash: { [key]: day.cashSales },
      qris: { [key]: day.qrisSales ?? 0 },
      nonSales: { [key]: day.nonSalesCashMovement },
    },
  );
}

const tx = (over: Partial<DaySalesInput>): DaySalesInput => ({
  paymentMethod: "CASH",
  cashAmount: 0,
  qrisAmount: 0,
  totalAmount: 0,
  service: null,
  ...over,
});

describe("parity: the ordinary day both formulas must agree on", () => {
  it("cash sales minus pengeluaran gives the same expected drawer", () => {
    const register = { openingCash: 200_000, closingCash: 640_000 };
    const cashSales = 500_000;
    const pengeluaran = 60_000;

    const old = masterReconcile(register, { cashIncome: cashSales, totalExpenses: pengeluaran });
    // Money out is a NEGATIVE movement on the kas account in the ledger.
    const now = current(register, { cashSales, nonSalesCashMovement: -pengeluaran });

    expect(now.expectedClosing).toBe(old.expectedClosing);
    expect(now.difference).toBe(old.difference);
    expect(now.expectedClosing).toBe(640_000);
    expect(now.difference).toBe(0);
  });

  it("a quiet day with no sales and no spending agrees", () => {
    const register = { openingCash: 150_000, closingCash: 150_000 };
    const old = masterReconcile(register, { cashIncome: 0, totalExpenses: 0 });
    const now = current(register, { cashSales: 0, nonSalesCashMovement: 0 });
    expect(now.expectedClosing).toBe(old.expectedClosing);
    expect(now.difference).toBe(0);
  });

  it("a shortage is the same size and the same sign in both", () => {
    const register = { openingCash: 200_000, closingCash: 630_000 };
    const old = masterReconcile(register, { cashIncome: 500_000, totalExpenses: 60_000 });
    const now = current(register, { cashSales: 500_000, nonSalesCashMovement: -60_000 });
    expect(now.difference).toBe(old.difference);
    expect(now.difference).toBe(-10_000);
  });

  it("an unclosed day has no selisih in either", () => {
    const register = { openingCash: 200_000, closingCash: null };
    const old = masterReconcile(register, { cashIncome: 500_000, totalExpenses: 0 });
    const now = current(register, { cashSales: 500_000, nonSalesCashMovement: 0 });
    expect(now.difference).toBeNull();
    expect(old.difference).toBeNull();
  });

  it("money out is reported under the old totalExpenses name and shape", () => {
    const now = current(
      { openingCash: 100_000, closingCash: null },
      { cashSales: 0, nonSalesCashMovement: -75_000 },
    );
    expect(now.totalExpenses).toBe(75_000);
  });
});

describe("parity: the three places the formulas differ, and why", () => {
  it("a split payment — master counted no cash for it at all", () => {
    const txs = [
      tx({ paymentMethod: "CASH", totalAmount: 100_000 }),
      tx({ paymentMethod: "SPLIT", cashAmount: 30_000, qrisAmount: 20_000, totalAmount: 50_000 }),
    ];

    // Master filtered on paymentMethod === "CASH", so the 30.000 cash leg of a
    // split sale never reached expected drawer cash: the drawer then counted
    // 30.000 "over" every time a customer paid part cash, part QRIS.
    expect(masterCashIncome(txs)).toBe(100_000);
    expect(sumDaySales(txs).cashSales).toBe(130_000);
    expect(sumDaySales(txs).qrisSales).toBe(20_000);
  });

  it("cash into the drawer (transfer/modal) — master could not represent it", () => {
    const register = { openingCash: 100_000, closingCash: 400_000 };
    const modal = 200_000;

    // The Expense table only held money OUT, so master's expected drawer
    // ignored cash put IN and reported a 200.000 surplus on a balanced day.
    const old = masterReconcile(register, { cashIncome: 100_000, totalExpenses: 0 });
    const now = current(register, { cashSales: 100_000, nonSalesCashMovement: +modal });

    expect(old.difference).toBe(200_000);
    expect(now.difference).toBe(0);
    expect(now.expectedClosing - old.expectedClosing).toBe(modal);
  });

  it("a cash sale on an online-platform session is left out of the drawer now", () => {
    const txs = [tx({ paymentMethod: "CASH", totalAmount: 80_000, service: "GoFood" })];

    // GoFood/ShopeeFood/GrabFood revenue is recognised at settlement, so
    // sumDaySales skips those sessions. Master counted this into the drawer.
    // It only bites if someone records a platform order as paid in cash at the
    // counter, which the flow does not produce — an online session is PENDING
    // until its pencairan, and master ignored PENDING as well.
    expect(masterCashIncome(txs)).toBe(80_000);
    expect(sumDaySales(txs).cashSales).toBe(0);
  });

  it("both formulas ignore an unpaid PENDING order", () => {
    const txs = [tx({ paymentMethod: "PENDING", totalAmount: 90_000, service: "GoFood" })];
    expect(masterCashIncome(txs)).toBe(0);
    expect(sumDaySales(txs).cashSales).toBe(0);
  });
});
