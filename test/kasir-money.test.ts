import { describe, it, expect } from "vitest";
import {
  assertTransactionMoney,
  assertSubtotalMatchesItems,
} from "@/lib/kasir-money";
import { ActionError } from "@/lib/action-error";

/**
 * Unit tests for the server-side money model applied to synced cashier
 * transactions (lib/kasir-money.ts). These encode the REAL client semantics —
 * tendered cash, per-group splits, cancelled items, finalized aggregates —
 * the first version of this check got them wrong and silently dropped sales.
 */

const paid = (over: Partial<Parameters<typeof assertTransactionMoney>[0]>) => ({
  status: "PAID",
  paymentMethod: "CASH",
  subtotal: 38000,
  taxAmount: 0,
  serviceCharge: 0,
  discountAmount: 0,
  totalAmount: 38000,
  cashAmount: 38000,
  qrisAmount: 0,
  splitGroup: 0,
  ...over,
});

const item = (over: Partial<Parameters<typeof assertSubtotalMatchesItems>[1][number]>) => ({
  status: "SERVED",
  price: 19000,
  qty: 2,
  splitGroup: 0,
  ...over,
});

/** Assert fn throws an ActionError (the user-copy channel the sync path surfaces). */
function expectActionError(fn: () => void) {
  let threw: unknown;
  try {
    fn();
  } catch (e) {
    threw = e;
  }
  expect(threw).toBeInstanceOf(ActionError);
}

describe("assertTransactionMoney — CASH", () => {
  it("accepts over-tender (cashAmount is the amount tendered, change = difference)", () => {
    expect(() => assertTransactionMoney(paid({ cashAmount: 50000 }))).not.toThrow();
  });

  it("accepts exact tender", () => {
    expect(() => assertTransactionMoney(paid({}))).not.toThrow();
  });

  it("rejects under-tender", () => {
    expectActionError(() => assertTransactionMoney(paid({ cashAmount: 20000 })));
  });

  it("rejects a QRIS amount on a cash payment", () => {
    expectActionError(() => assertTransactionMoney(paid({ qrisAmount: 5000 })));
  });
});

describe("assertTransactionMoney — QRIS", () => {
  it("accepts qrisAmount = total, cash = 0", () => {
    expect(() =>
      assertTransactionMoney(paid({ paymentMethod: "QRIS", cashAmount: 0, qrisAmount: 38000 })),
    ).not.toThrow();
  });

  it("rejects a partial QRIS", () => {
    expectActionError(() =>
      assertTransactionMoney(paid({ paymentMethod: "QRIS", cashAmount: 0, qrisAmount: 30000 })),
    );
  });
});

describe("assertTransactionMoney — SPLIT", () => {
  const split = paid({ paymentMethod: "SPLIT", cashAmount: 20000, qrisAmount: 18000 });

  it("accepts cash part + qris remainder = total", () => {
    expect(() => assertTransactionMoney(split, [])).not.toThrow();
  });

  it("rejects when the parts do not add up", () => {
    expectActionError(() =>
      assertTransactionMoney(paid({ paymentMethod: "SPLIT", cashAmount: 20000, qrisAmount: 10000 })),
    );
  });

  it("rejects an all-cash SPLIT (that is a CASH payment)", () => {
    expectActionError(() =>
      assertTransactionMoney(paid({ paymentMethod: "SPLIT", cashAmount: 38000, qrisAmount: 0 })),
    );
  });
});

describe("assertTransactionMoney — component totals", () => {
  it("enforces total = subtotal + tax + service − discount", () => {
    expect(() =>
      assertTransactionMoney(
        paid({
          subtotal: 38000,
          taxAmount: 3800,
          serviceCharge: 0,
          discountAmount: 1800,
          totalAmount: 40000,
          cashAmount: 40000,
        }),
        [],
      ),
    ).not.toThrow();
  });

  it("rejects drift between components and total", () => {
    expectActionError(() =>
      assertTransactionMoney(paid({ subtotal: 38000, taxAmount: 3800, totalAmount: 42000 })),
    );
  });
});

describe("assertTransactionMoney — skipped paths", () => {
  it("skips PENDING-method transactions (recorded unpaid, settled later)", () => {
    expect(() =>
      assertTransactionMoney(
        paid({ paymentMethod: "PENDING", cashAmount: 0, qrisAmount: 0 }),
        [],
      ),
    ).not.toThrow();
  });

  it("skips VOIDED transactions", () => {
    expect(() =>
      assertTransactionMoney(paid({ status: "VOIDED", cashAmount: 1, qrisAmount: 999 })),
    ).not.toThrow();
  });

  it("rejects unknown method/status", () => {
    expectActionError(() => assertTransactionMoney(paid({ paymentMethod: "BITCOIN" })));
    expectActionError(() => assertTransactionMoney(paid({ status: "MAYBE" })));
  });
});

describe("assertSubtotalMatchesItems", () => {
  it("accepts subtotal from the transaction's own split group", () => {
    expect(() =>
      assertSubtotalMatchesItems(paid({ subtotal: 48000, totalAmount: 48000 }), [
        item({}),
        item({ price: 5000, qty: 2 }),
      ]),
    ).not.toThrow();
  });

  it("excludes CANCELLED items (client calcSubtotal semantics)", () => {
    expect(() =>
      assertSubtotalMatchesItems(paid({ subtotal: 38000 }), [
        item({}),
        item({ price: 99000, qty: 1, status: "CANCELLED" }),
      ]),
    ).not.toThrow();
  });

  it("rejects when the group subtotal does not explain the transaction", () => {
    expectActionError(() => assertSubtotalMatchesItems(paid({ subtotal: 99000 }), [item({})]));
  });

  it("accepts the finalized whole-session aggregate (splitGroup 0 across assigned groups)", () => {
    const aggregate = paid({ subtotal: 61000, totalAmount: 61000 });
    const items = [
      item({ price: 25000, qty: 1, splitGroup: 1 }),
      item({ price: 18000, qty: 2, splitGroup: 2 }),
    ];
    expect(() => assertSubtotalMatchesItems(aggregate, items)).not.toThrow();
  });

  it("rejects an aggregate whose sum crosses neither shape", () => {
    const aggregate = paid({ subtotal: 70000, totalAmount: 70000 });
    const items = [
      item({ price: 25000, qty: 1, splitGroup: 1 }),
      item({ price: 18000, qty: 2, splitGroup: 2 }),
    ];
    expectActionError(() => assertSubtotalMatchesItems(aggregate, items));
  });

  it("skips the items check for VOIDED and empty item lists", () => {
    expect(() => assertSubtotalMatchesItems(paid({ status: "VOIDED", subtotal: 1 }), [])).not.toThrow();
    expect(() => assertSubtotalMatchesItems(paid({ subtotal: 1 }), [])).not.toThrow();
  });
});
