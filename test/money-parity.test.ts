import { describe, it, expect } from "vitest";
import { calcSubtotal, calcChargeAmount, type ChargeInput } from "@/lib/kasir-utils";
import { parsePushPayload, type PushOrigin } from "@/lib/kasir-payload";
import type { OrderItem, TableSession, Transaction } from "@/lib/db";

/**
 * PARITY SUITE — the pre-branch bar.
 *
 * Before this branch, app/actions/push-transaction.ts accepted every payload a
 * cashier device sent and wrote it straight to Postgres: no auth, no schema, no
 * money check. That code has run the business for months, so every payload the
 * real client can build is by definition a legitimate sale.
 *
 * This branch put a gate in front of it. The gate is only an improvement if it
 * rejects NOTHING the old server accepted — the sync path
 * (hooks/use-session-store.ts) merely retries and console.errors, so a rejected
 * payload is a sale that never reaches the books and never tells anyone.
 *
 * Each case below builds its payload the way the client builds it
 * (components/kasir/payment-screen.tsx lines 101-156 -> recordPayment), using
 * the SAME lib/kasir-utils math the screen uses, then asserts the gate lets it
 * through.
 */

const ISO = "2026-08-30T04:12:00.000Z";

function makeItem(over: Partial<OrderItem> = {}): OrderItem {
  return {
    id: `item-${Math.random().toString(36).slice(2, 10)}`,
    tableSessionId: "sess-1",
    menuItemId: "menu-1",
    packageId: null,
    variantId: null,
    qty: 1,
    note: null,
    status: "SERVED",
    nameSnapshot: "Sate Kambing",
    price: 25000,
    splitGroup: 0,
    preparedAt: null,
    servedAt: ISO,
    cancelledAt: null,
    createdAt: ISO,
    synced: 0,
    ...over,
  };
}

function makeSession(over: Partial<TableSession> = {}): TableSession {
  return {
    id: "sess-1",
    name: "Meja 1",
    service: null,
    externalOrderId: null,
    customerAlias: null,
    customerPhone: null,
    ownerId: "staff-1",
    orderedAt: ISO,
    servedAt: null,
    paidAt: ISO,
    erasedAt: null,
    createdAt: ISO,
    synced: 0,
    ...over,
  };
}

const noCharge: ChargeInput = { value: 0, mode: "abs" };

/**
 * Mirrors components/kasir/payment-screen.tsx: charge amounts come from
 * calcChargeAmount over the group's subtotal, the total is
 * subtotal + tax + service - discount, and cash/qris are filled per method.
 */
function buildPayment(opts: {
  items: OrderItem[];
  method: Transaction["paymentMethod"];
  /** Amount TENDERED for CASH; the cash PART for SPLIT. */
  cashInput?: number;
  tax?: ChargeInput;
  service?: ChargeInput;
  discount?: ChargeInput;
  splitGroup?: number;
  status?: Transaction["status"];
  session?: Partial<TableSession>;
  /** Defaults to a fresh payment — the strictest reading of the payload. */
  origin?: PushOrigin;
}) {
  const { items, method } = opts;
  const group = opts.splitGroup;
  const payFor = group === undefined ? items : items.filter((i) => i.splitGroup === group);
  const subtotal = calcSubtotal(payFor);

  const taxAmount = calcChargeAmount(subtotal, opts.tax ?? noCharge);
  const serviceAmount = calcChargeAmount(subtotal, opts.service ?? noCharge);
  const discountAmount = calcChargeAmount(subtotal, opts.discount ?? noCharge);
  const total = subtotal + taxAmount + serviceAmount - discountAmount;

  const cashInput = opts.cashInput ?? 0;
  const cashAmount = method === "CASH" || method === "SPLIT" ? cashInput : 0;
  const qrisAmount =
    method === "QRIS" ? total : method === "SPLIT" ? Math.max(0, total - cashAmount) : 0;

  const transaction: Transaction = {
    id: "tx-1",
    tableSessionId: "sess-1",
    processedById: "staff-1",
    cashierName: "Adi",
    subtotal,
    taxAmount,
    serviceCharge: serviceAmount,
    discountAmount,
    totalAmount: total,
    cashAmount,
    qrisAmount,
    paymentMethod: method,
    splitGroup: group ?? 0,
    status: opts.status ?? "PAID",
    paidAt: ISO,
    createdAt: ISO,
    synced: 0,
  };

  return {
    session: makeSession(opts.session),
    orderItems: items,
    transaction,
    origin: opts.origin ?? ("payment" as PushOrigin),
  };
}

/** The gate must accept this payload and pass the money through unchanged. */
function accepts(payload: ReturnType<typeof buildPayment>) {
  const parsed = parsePushPayload(payload);
  expect(parsed.transaction.totalAmount).toBe(payload.transaction.totalAmount);
  expect(parsed.transaction.subtotal).toBe(payload.transaction.subtotal);
  expect(parsed.orderItems).toHaveLength(payload.orderItems.length);
  return parsed;
}

// A. Every payment shape the screen can produce

describe("parity: payment methods the cashier screen can produce", () => {
  it("cash, tendered exactly", () => {
    accepts(buildPayment({ items: [makeItem({ qty: 2 })], method: "CASH", cashInput: 50000 }));
  });

  it("cash, over-tendered (kembalian)", () => {
    accepts(buildPayment({ items: [makeItem({ qty: 2 })], method: "CASH", cashInput: 100000 }));
  });

  it("QRIS", () => {
    accepts(buildPayment({ items: [makeItem()], method: "QRIS" }));
  });

  it("split — cash part plus QRIS remainder", () => {
    accepts(buildPayment({ items: [makeItem({ qty: 4 })], method: "SPLIT", cashInput: 40000 }));
  });

  it("PENDING — an online order recorded before settlement", () => {
    accepts(
      buildPayment({
        items: [makeItem({ qty: 3 })],
        method: "PENDING",
        session: { service: "GoFood", externalOrderId: "GF-9931" },
      }),
    );
  });

  it("a VOIDED transaction re-synced after the void", () => {
    accepts(
      buildPayment({
        items: [makeItem()],
        method: "CASH",
        cashInput: 25000,
        status: "VOIDED",
      }),
    );
  });
});

describe("parity: charges and discounts", () => {
  it("percentage tax and service charge, rounded by the same helper", () => {
    const parsed = accepts(
      buildPayment({
        items: [makeItem({ price: 17500, qty: 3 })],
        method: "CASH",
        cashInput: 100000,
        tax: { value: 11, mode: "pct" },
        service: { value: 5, mode: "pct" },
      }),
    );
    expect(parsed.transaction.taxAmount).toBe(Math.round(52500 * 0.11));
  });

  it("absolute discount", () => {
    accepts(
      buildPayment({
        items: [makeItem({ qty: 2 })],
        method: "CASH",
        cashInput: 45000,
        discount: { value: 5000, mode: "abs" },
      }),
    );
  });

  it("percentage discount", () => {
    accepts(
      buildPayment({
        items: [makeItem({ qty: 2 })],
        method: "QRIS",
        discount: { value: 10, mode: "pct" },
      }),
    );
  });

  it("a full 100% discount — total zero, nothing tendered", () => {
    const parsed = accepts(
      buildPayment({
        items: [makeItem()],
        method: "CASH",
        cashInput: 0,
        discount: { value: 100, mode: "pct" },
      }),
    );
    expect(parsed.transaction.totalAmount).toBe(0);
  });

  it("a discount larger than the bill — the screen allows it, so the server must store it", () => {
    const parsed = accepts(
      buildPayment({
        items: [makeItem()],
        method: "CASH",
        cashInput: 0,
        discount: { value: 30000, mode: "abs" },
      }),
    );
    expect(parsed.transaction.totalAmount).toBeLessThan(0);
  });
});

describe("parity: item shapes", () => {
  it("cancelled items leave the subtotal but still travel in the payload", () => {
    const items = [
      makeItem({ id: "a", qty: 2 }),
      makeItem({ id: "b", status: "CANCELLED", cancelledAt: ISO }),
    ];
    const parsed = accepts(buildPayment({ items, method: "CASH", cashInput: 50000 }));
    expect(parsed.transaction.subtotal).toBe(50000);
  });

  it("a package line (packageId, no menuItemId)", () => {
    const items = [makeItem({ menuItemId: null, packageId: "pkg-1", nameSnapshot: "Paket Hemat" })];
    accepts(buildPayment({ items, method: "CASH", cashInput: 25000 }));
  });

  it("free text a cashier can actually type is not length-rejected", () => {
    accepts(
      buildPayment({
        items: [makeItem({ note: "pedas sekali, ".repeat(20) })],
        method: "CASH",
        cashInput: 25000,
        session: {
          name: "Pesanan besar ".repeat(10),
          customerAlias: "Bu Sri ".repeat(20),
          customerPhone: "0812-3456-7890",
        },
      }),
    );
  });
});

describe("parity: split-group sessions", () => {
  const grouped = () => [
    makeItem({ id: "g1", splitGroup: 1, price: 25000, qty: 2 }),
    makeItem({ id: "g2", splitGroup: 2, price: 18000, qty: 1 }),
  ];

  it("each group pays for its own items", () => {
    const items = grouped();
    const one = accepts(buildPayment({ items, method: "CASH", cashInput: 50000, splitGroup: 1 }));
    expect(one.transaction.subtotal).toBe(50000);
    const two = accepts(buildPayment({ items, method: "QRIS", splitGroup: 2 }));
    expect(two.transaction.subtotal).toBe(18000);
  });

  it("one payment for the whole session while items carry groups (the aggregate)", () => {
    const parsed = accepts(buildPayment({ items: grouped(), method: "CASH", cashInput: 100000 }));
    expect(parsed.transaction.subtotal).toBe(68000);
    expect(parsed.transaction.splitGroup).toBe(0);
  });
});

// B. Drift: the retry path re-reads Dexie, so the item list may have moved on

/**
 * retryUnsyncedTransactions (hooks/use-session-store.ts) loads the session's
 * order items AT RETRY TIME, not as they stood when the sale was paid. A device
 * that was offline overnight can push a correct, already-collected sale next to
 * an item list that has since changed. The old server stored it; these cases
 * pin down that the gate still does.
 */
describe("parity: a retry whose item list drifted since payment", () => {
  it("an item cancelled after the sale was paid", () => {
    const items = [makeItem({ id: "a", qty: 2 }), makeItem({ id: "b", price: 18000 })];
    const payload = buildPayment({ items, method: "CASH", cashInput: 70000, origin: "retry" });
    payload.orderItems[1].status = "CANCELLED";
    payload.orderItems[1].cancelledAt = ISO;
    accepts(payload);
  });

  it("a quantity corrected after the sale was paid", () => {
    const payload = buildPayment({
      items: [makeItem({ id: "a", qty: 2 })],
      method: "CASH",
      cashInput: 50000,
      origin: "retry",
    });
    payload.orderItems[0].qty = 1;
    accepts(payload);
  });

  it("an item deleted after the sale was paid", () => {
    const items = [makeItem({ id: "a", qty: 2 }), makeItem({ id: "b", price: 18000 })];
    const payload = buildPayment({ items, method: "CASH", cashInput: 70000, origin: "retry" });
    payload.orderItems = [payload.orderItems[0]];
    accepts(payload);
  });

  it("items added to the session after the sale was paid", () => {
    const payload = buildPayment({
      items: [makeItem({ id: "a", qty: 2 })],
      method: "CASH",
      cashInput: 50000,
      origin: "retry",
    });
    payload.orderItems = [...payload.orderItems, makeItem({ id: "later", price: 30000 })];
    accepts(payload);
  });
});

/**
 * The lenient retry reading must not become a hole: a payload whose subtotal is
 * unexplainable is still refused as it happens, and a drifted retry is still
 * reported rather than passing unnoticed.
 */
describe("the drift allowance stays narrow", () => {
  it("a FRESH payment whose subtotal does not match its items is refused", () => {
    const payload = buildPayment({
      items: [makeItem({ id: "a", qty: 2 })],
      method: "CASH",
      cashInput: 50000,
    });
    payload.transaction.subtotal = 90000;
    payload.transaction.totalAmount = 90000;
    payload.transaction.cashAmount = 90000;
    expect(() => parsePushPayload(payload)).toThrow(/Subtotal tidak cocok/);
  });

  it("a drifted retry is accepted but flagged for the log", () => {
    const payload = buildPayment({
      items: [makeItem({ id: "a", qty: 2 })],
      method: "CASH",
      cashInput: 50000,
      origin: "retry",
    });
    payload.orderItems[0].qty = 1;
    expect(parsePushPayload(payload).subtotalDrift).toMatch(/Subtotal tidak cocok/);
  });

  it("a retry still cannot break the transaction's own arithmetic", () => {
    const payload = buildPayment({
      items: [makeItem({ id: "a", qty: 2 })],
      method: "CASH",
      cashInput: 50000,
      origin: "retry",
    });
    payload.transaction.totalAmount = 10000;
    expect(() => parsePushPayload(payload)).toThrow(/Total tidak cocok/);
  });
});
