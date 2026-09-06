/**
 * loader.ts — the reusable migration loader, extracted from
 * test/migrasi-warungbooks.test.ts phases B through E (books configuration,
 * operational-data load with cutoff-cascading, ev_capital/ev_transfer/
 * ev_expense posting through the real repositories, and the day-close loop),
 * plus four behavior changes documented in docs/migrasi-data.md decisions 5,
 * 7 and 8:
 *
 *   (a) staff.supabaseUserId is nulled on every imported staff row — the old
 *       project's auth pointer is stale and more dangerous than an empty
 *       column (decision 7).
 *   (b) the one online settlement whose numbers do not balance to the peser
 *       (GoFood, 29 Aug, residual Rp 211) gets one extra settlement_deductions
 *       row inserted to absorb the gap, clearly labelled (decision 8).
 *   (c) KOMISI-category ev_expense rows are excluded from posting — kasir's
 *       settlement posting already books Expenses:Operasional:KomisiOnline itself,
 *       so importing Warung Books' KOMISI rows too would double-count it
 *       (decision 5).
 *   (d) the five online settlements are posted through
 *       SettlementPostingRepository after day-close, so the online income
 *       kasir recognizes at settlement (not at order time) actually lands in
 *       the ledger.
 *
 * Constraints (do not violate when editing this file):
 *   - Takes the PrismaClient as a parameter. MUST NOT import lib/prisma.ts,
 *     MUST NOT read process.env, MUST NOT read a .env file, anywhere here.
 *   - Reads its two JSON inputs by path relative to this module via
 *     `new URL(..., import.meta.url)`, same pattern the test used.
 *   - Moved logic is kept byte-similar to the test it came from — this file
 *     relocates and parameterizes known-good code, it does not rewrite it.
 */

import { readFileSync } from "node:fs";
import type { PrismaClient } from "../../generated/prisma";
import { ExpenseRepository } from "../../lib/accounting/expenseRepository";
import { CatatRepository } from "../../lib/accounting/catatRepository";
import { SalesPostingRepository } from "../../lib/accounting/salesPostingRepository";
import { SettlementPostingRepository } from "../../lib/accounting/settlementPostingRepository";
import { CASH_ACCOUNTS, CASH_LABELS, accountForKey } from "../../lib/accounting/accounts";
import { sumDaySales, type DaySalesInput } from "../../lib/day-close";

// ---------------------------------------------------------------------------
// Input file locations — relative to THIS module, not the caller.
// ---------------------------------------------------------------------------

const DEFAULT_EVENTS_PATH = new URL("./warungbooks-events.json", import.meta.url);
const DEFAULT_BACKUP_PATH = new URL("../../backup-2026-09-06.json", import.meta.url);

/** Every month operational data + books events are loaded for. Independent
 *  of which months a caller later chooses to compare/report on — August is
 *  always loaded and always day-closed here (decision 3/10 in
 *  docs/migrasi-data.md), only its REPORT is out of scope for the WB diff.
 *
 *  2026-09 added 2026-09-06: each month here creates its AccountingMonth row,
 *  and a day-close cannot post without an open month, so September's days
 *  would be silently unposted without it. */
const LOAD_MONTHS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"] as const;

/** Inclusive cap on every operational row. Raised to 2026-09-06 so the new
 *  database catches up with the old production system, which stays in use
 *  during the parallel run. backup-2026-09-06.json actually ends on
 *  2026-09-05 (no sales had been rung on the 6th when it was exported), so
 *  this cap currently excludes nothing — it is the intended boundary, not a
 *  description of the data. */
const CUTOFF_DATE = "2026-09-06";

/** A settlement residual in this range gets one adjusting deduction row
 *  instead of being treated as a real discrepancy (decision 8). */
const RESIDUAL_ADJUSTMENT_MAX = 1000;

// ---------------------------------------------------------------------------
// Loose input types — just enough shape to drive the migration, not a full
// schema of either source file.
// ---------------------------------------------------------------------------

interface WbCategory {
  category_code: string;
  category_name: string;
  /** Warung Books' own spelling, kept verbatim — mapped at load time. */
  bucket: "HPP" | "OpEx";
}

interface WbCapital {
  id: number;
  date: string;
  investor: string;
  acct: string;
  amount: string;
}

interface WbExpense {
  id: number;
  date: string;
  paid_from: string;
  item: string;
  qty: string;
  unit_price: string;
  amount: string;
  category_code: string;
}

interface WbTransfer {
  id: number;
  date: string;
  from_acct: string;
  to_acct: string;
  amount: string;
  note: string | null;
}

interface WbEvents {
  categories: WbCategory[];
  cash_accounts: { key: string; label: string; active: number; sort: number }[];
  closed_months: { month: string; closed_at: string }[];
  ev_capital: WbCapital[];
  ev_sale: { id: number; date: string; tunai: string; qris: string; online: string }[];
  ev_expense: WbExpense[];
  ev_transfer: WbTransfer[];
}

interface Backup {
  version: number;
  exportedAt: string;
  tables: Record<string, Array<Record<string, unknown>>>;
}

// ---------------------------------------------------------------------------
// Rejection / row-count tracking — surfaced in the returned result, not
// thrown, except for a settlement residual outside the tolerated range
// (behavior b) which is a real discrepancy and must fail loud.
// ---------------------------------------------------------------------------

export interface Rejection {
  stage: string;
  input: unknown;
  error: string;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export interface SettlementResult {
  settlementId: string;
  service: string;
  date: string;
  /** The extra settlement_deductions amount inserted for this settlement to
   *  absorb a small residual (decision 8), or null if none was needed. */
  adjustment: number | null;
  ok: boolean;
  journalEntryId?: string;
  error?: string;
}

export interface MigrasiResult {
  rowCounts: Record<string, number>;
  rejections: Rejection[];
  dayCloseCount: number;
  dayCloseTotal: number;
  settlements: SettlementResult[];
  excludedKomisi: { count: number; total: number };
}

export interface RunMigrasiOptions {
  eventsPath?: URL;
  backupPath?: URL;
}

// ---------------------------------------------------------------------------
// Date conversion for the operational backup — DateTime columns arrive as ISO
// strings in the JSON export and must become real Date objects before they
// reach createMany (pglite/Prisma reject bare strings for DateTime columns).
// ---------------------------------------------------------------------------

function withDates<T extends Record<string, unknown>>(rows: T[], fields: string[]): T[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = { ...row };
    for (const f of fields) {
      if (out[f] !== null && out[f] !== undefined) out[f] = new Date(out[f] as string);
    }
    return out as T;
  });
}

/** Ascending (date, id) sort — deterministic processing order per event group. */
function byDate<T extends { date: string; id: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1));
}

/** "YYYY-MM-DD" prefix of an ISO datetime string/value, for cutoff comparison. */
function dateKey(v: unknown): string {
  return String(v).slice(0, 10);
}

function withinCutoff(v: unknown): boolean {
  return dateKey(v) <= CUTOFF_DATE;
}

// ---------------------------------------------------------------------------
// The loader
// ---------------------------------------------------------------------------

export async function runMigrasi(prisma: PrismaClient, opts: RunMigrasiOptions = {}): Promise<MigrasiResult> {
  const eventsPath = opts.eventsPath ?? DEFAULT_EVENTS_PATH;
  const backupPath = opts.backupPath ?? DEFAULT_BACKUP_PATH;

  const events = JSON.parse(readFileSync(eventsPath, "utf8")) as WbEvents;
  const backup = JSON.parse(readFileSync(backupPath, "utf8")) as Backup;

  const rejections: Rejection[] = [];
  const rowCounts: Record<string, number> = {};

  // -----------------------------------------------------------------------
  // B. Books configuration — as a user would set it up in /buku/setup.
  // -----------------------------------------------------------------------

  const expenseRepo = new ExpenseRepository(prisma);
  for (const c of events.categories) {
    try {
      await expenseRepo.createCategory({
        code: c.category_code,
        name: c.category_name,
        bucket: c.bucket === "HPP" ? "BAHAN_BAKU" : "OPERASIONAL",
      });
    } catch (e) {
      rejections.push({ stage: "category", input: c, error: errMsg(e) });
    }
  }
  rowCounts["kategori pengeluaran"] = events.categories.length - rejections.filter((r) => r.stage === "category").length;

  for (const key of Object.keys(CASH_ACCOUNTS) as (keyof typeof CASH_ACCOUNTS)[]) {
    const name = CASH_ACCOUNTS[key];
    await prisma.ledgerAccount.create({
      data: { code: key, name, label: CASH_LABELS[name] ?? null, type: "ASSET" },
    });
  }

  await prisma.salesChannelAccount.createMany({
    data: [
      { channel: "tunai", account: "Assets:Cash:Warung" },
      { channel: "elektronik", account: "Assets:Cash:Mandiri" },
      { channel: "online", account: "Assets:Cash:Mandiri" },
    ],
  });

  for (const month of LOAD_MONTHS) {
    await prisma.accountingMonth.create({ data: { month } });
  }

  // -----------------------------------------------------------------------
  // C. Operational data — the backup export, FK-ordered. `cogs` no longer
  // exists on Transaction (dropped from the schema); the six ingredient/
  // stock-opname/expense tables in the backup were dropped along with the
  // COGS screens and are skipped entirely.
  // -----------------------------------------------------------------------

  async function load(label: string, fn: () => Promise<{ count: number }>): Promise<void> {
    const result = await fn();
    rowCounts[label] = result.count;
  }

  const t = backup.tables;

  // -----------------------------------------------------------------------
  // Cap at CUTOFF_DATE, cascading so nothing is ever inserted with a
  // foreign key pointing at a row that got capped out.
  //
  // - transactions: capped by paidAt.
  // - tableSessions: kept when either the session itself was created on or
  //   before the cutoff, OR a kept (<=cutoff) transaction still points at
  //   it — so a session whose only transactions are all in September is
  //   dropped along with them, but a session that legitimately straddles
  //   the boundary is not orphaned.
  // - orderItems: kept only when their tableSession survived the cap
  //   above — never inserted against a session we didn't import.
  // - cashRegisters / attendanceRecords: capped independently by their own
  //   date column.
  // - settlementItems: kept only when their transaction survived the cap —
  //   never inserted against a transaction we didn't import.
  // -----------------------------------------------------------------------

  const allTransactions = t.transactions;
  const keptTransactions = allTransactions.filter((tx) => withinCutoff(tx.paidAt));
  const keptTransactionIds = new Set(keptTransactions.map((tx) => tx.id as string));

  const allTableSessions = t.tableSessions;
  const sessionIdsUsedByKeptTransactions = new Set(keptTransactions.map((tx) => tx.tableSessionId as string));
  const keptTableSessions = allTableSessions.filter(
    (s) => withinCutoff(s.createdAt) || sessionIdsUsedByKeptTransactions.has(s.id as string),
  );
  const keptTableSessionIds = new Set(keptTableSessions.map((s) => s.id as string));

  const allOrderItems = t.orderItems;
  const keptOrderItems = allOrderItems.filter((oi) => keptTableSessionIds.has(oi.tableSessionId as string));

  const allCashRegisters = t.cashRegisters;
  const keptCashRegisters = allCashRegisters.filter((r) => withinCutoff(r.date));

  const allAttendance = t.attendanceRecords;
  const keptAttendance = allAttendance.filter((r) => withinCutoff(r.date));

  const allSettlementItems = t.settlementItems;
  const keptSettlementItems = allSettlementItems.filter((si) => keptTransactionIds.has(si.transactionId as string));

  rowCounts[`transaksi dilewati (setelah ${CUTOFF_DATE})`] = allTransactions.length - keptTransactions.length;
  rowCounts[`sesi meja dilewati (setelah ${CUTOFF_DATE})`] = allTableSessions.length - keptTableSessions.length;
  rowCounts["order item dilewati (sesi meja dilewati)"] = allOrderItems.length - keptOrderItems.length;
  rowCounts[`cash register dilewati (setelah ${CUTOFF_DATE})`] = allCashRegisters.length - keptCashRegisters.length;
  rowCounts[`absensi dilewati (setelah ${CUTOFF_DATE})`] = allAttendance.length - keptAttendance.length;
  rowCounts["settlement item dilewati (transaksi dilewati)"] =
    allSettlementItems.length - keptSettlementItems.length;

  await load("categories", () =>
    prisma.category.createMany({ data: withDates(t.categories, ["createdAt", "updatedAt"]) as never }),
  );

  // (a) Null the staff auth pointers — the six staff rows still load, only
  // their pointer into the old project's Supabase Auth is dropped (decision
  // 7): a stale pointer is more dangerous than an empty column.
  const staffNoAuthPointer = t.staff.map((row) => ({ ...row, supabaseUserId: null }));
  await load("staff", () =>
    prisma.staff.createMany({ data: withDates(staffNoAuthPointer, ["createdAt", "updatedAt"]) as never }),
  );

  await load("menuItems", () =>
    prisma.menuItem.createMany({ data: withDates(t.menuItems, ["createdAt", "updatedAt"]) as never }),
  );
  await load("menuVariants", () => prisma.menuVariant.createMany({ data: t.menuVariants as never }));
  await load("packages", () =>
    prisma.package.createMany({ data: withDates(t.packages, ["createdAt", "updatedAt"]) as never }),
  );
  await load("packageItems", () => prisma.packageItem.createMany({ data: t.packageItems as never }));
  await load("menuItemOnlinePrices", () =>
    prisma.menuItemOnlinePrice.createMany({ data: t.menuItemOnlinePrices as never }),
  );
  await load("tableSessions", () =>
    prisma.tableSession.createMany({
      data: withDates(keptTableSessions, ["orderedAt", "servedAt", "paidAt", "erasedAt", "createdAt"]) as never,
    }),
  );
  await load("orderItems", () =>
    prisma.orderItem.createMany({
      data: withDates(keptOrderItems, ["preparedAt", "servedAt", "cancelledAt", "createdAt"]) as never,
    }),
  );

  const transactionsNoCogs = keptTransactions.map((row) => {
    const clean = { ...row };
    delete clean.cogs;
    return clean;
  });
  await load("transactions", () =>
    prisma.transaction.createMany({
      data: withDates(transactionsNoCogs, ["voidedAt", "paidAt", "createdAt"]) as never,
    }),
  );

  await load("cashRegisters", () =>
    prisma.cashRegister.createMany({
      data: withDates(keptCashRegisters, ["date", "editedAt", "createdAt", "updatedAt"]) as never,
    }),
  );
  await load("attendanceRecords", () =>
    prisma.attendanceRecord.createMany({ data: withDates(keptAttendance, ["date", "markedAt"]) as never }),
  );
  await load("notifications", () =>
    prisma.notification.createMany({ data: withDates(t.notifications, ["readAt", "createdAt"]) as never }),
  );
  await load("settings", () =>
    prisma.setting.createMany({ data: withDates(t.settings, ["updatedAt"]) as never }),
  );
  await load("suppliers", () =>
    prisma.supplier.createMany({ data: withDates(t.suppliers, ["createdAt", "updatedAt"]) as never }),
  );
  await load("onlineSettlements", () =>
    prisma.onlineSettlement.createMany({
      data: withDates(t.onlineSettlements, ["settlementDate", "createdAt"]) as never,
    }),
  );
  await load("settlementItems", () => prisma.settlementItem.createMany({ data: keptSettlementItems as never }));
  await load("settlementDeductions", () =>
    prisma.settlementDeduction.createMany({ data: t.settlementDeductions as never }),
  );

  // -----------------------------------------------------------------------
  // (b) Balance the settlements — one extra settlement_deductions row per
  // settlement whose residual falls in (0, 1000], inserted now so it is
  // already present when deductionsTotal is summed for posting in (d).
  // A residual of 0 needs nothing; a residual outside (0, 1000] is a real
  // discrepancy this migration must not paper over, so it throws.
  // -----------------------------------------------------------------------

  interface WbSettlement {
    id: string;
    totalGross: number;
    commissionAmount: number;
    finalAmount: number;
  }
  interface WbDeduction {
    settlementId: string;
    amount: number;
  }

  const backupSettlements = t.onlineSettlements as unknown as WbSettlement[];
  const backupDeductions = t.settlementDeductions as unknown as WbDeduction[];
  const adjustmentBySettlement = new Map<string, number>();

  for (const s of backupSettlements) {
    const deductionsForSettlement = backupDeductions.filter((d) => d.settlementId === s.id);
    const deductionsSum = deductionsForSettlement.reduce((sum, d) => sum + d.amount, 0);
    const residual = s.totalGross - s.finalAmount - s.commissionAmount - deductionsSum;

    if (residual === 0) continue;

    if (residual < 0 || residual > RESIDUAL_ADJUSTMENT_MAX) {
      throw new Error(
        `Settlement ${s.id} residual ${residual} is outside the tolerated adjustment range (0, ${RESIDUAL_ADJUSTMENT_MAX}] — this is a real discrepancy, not something to paper over.`,
      );
    }

    await prisma.settlementDeduction.create({
      data: { settlementId: s.id, label: "Penyesuaian selisih pencairan", amount: residual },
    });
    adjustmentBySettlement.set(s.id, residual);
  }

  // -----------------------------------------------------------------------
  // D. Books events through the REAL repositories, each group in ascending
  // date order. Every failure is caught and reported, never thrown — a
  // rejected row is a finding for the caller to report, not a reason to
  // abort the whole migration run.
  //
  // (c) KOMISI-category ev_expense rows are excluded from posting — kasir's
  // settlement posting (below, step d) already books
  // Expenses:Operasional:KomisiOnline itself for the online commission, so
  // importing Warung Books' KOMISI expense rows too would double-count it
  // (decision 5).
  // -----------------------------------------------------------------------

  const catatRepo = new CatatRepository(prisma);

  let capitalPosted = 0;
  for (const c of byDate(events.ev_capital)) {
    try {
      await catatRepo.recordModal({
        date: c.date,
        nama: c.investor,
        akun: accountForKey(c.acct),
        jumlah: BigInt(c.amount),
      });
      capitalPosted += 1;
    } catch (e) {
      rejections.push({ stage: "ev_capital", input: c, error: errMsg(e) });
    }
  }

  let transferPosted = 0;
  for (const x of byDate(events.ev_transfer)) {
    try {
      await catatRepo.recordTransfer({
        date: x.date,
        dari: accountForKey(x.from_acct),
        ke: accountForKey(x.to_acct),
        jumlah: BigInt(x.amount),
        catatan: x.note ?? undefined,
      });
      transferPosted += 1;
    } catch (e) {
      rejections.push({ stage: "ev_transfer", input: x, error: errMsg(e) });
    }
  }

  const komisiExpenses = events.ev_expense.filter((x) => x.category_code === "KOMISI");
  const nonKomisiExpenses = events.ev_expense.filter((x) => x.category_code !== "KOMISI");
  const excludedKomisi = {
    count: komisiExpenses.length,
    total: komisiExpenses.reduce((sum, x) => sum + Number(x.amount), 0),
  };

  let expensePosted = 0;
  for (const x of byDate(nonKomisiExpenses)) {
    try {
      await expenseRepo.recordPengeluaran({
        date: x.date,
        akun: accountForKey(x.paid_from),
        item: x.item,
        qty: x.qty,
        hargaSatuan: BigInt(x.unit_price),
        jumlah: BigInt(x.amount),
        kategoriCode: x.category_code,
      });
      expensePosted += 1;
    } catch (e) {
      rejections.push({ stage: "ev_expense", input: x, error: errMsg(e) });
    }
  }

  rowCounts["modal (ev_capital) diposting"] = capitalPosted;
  rowCounts["ev_capital total"] = events.ev_capital.length;
  rowCounts["transfer (ev_transfer) diposting"] = transferPosted;
  rowCounts["ev_transfer total"] = events.ev_transfer.length;
  rowCounts["pengeluaran (ev_expense) diposting"] = expensePosted;
  rowCounts["ev_expense total (dikurangi KOMISI yang dikecualikan)"] = nonKomisiExpenses.length;
  rowCounts["ev_expense KOMISI dikecualikan"] = excludedKomisi.count;

  // -----------------------------------------------------------------------
  // E. One day-close per operating day, derived from the OPERATIONAL rows
  // just imported — never from ev_sale (reference-only, per the brief).
  // -----------------------------------------------------------------------

  const paidTransactions = await prisma.transaction.findMany({
    where: { status: "PAID" },
    select: {
      paymentMethod: true,
      cashAmount: true,
      qrisAmount: true,
      totalAmount: true,
      paidAt: true,
      tableSession: { select: { service: true } },
    },
  });

  const byDay = new Map<string, typeof paidTransactions>();
  for (const tx of paidTransactions) {
    const day = tx.paidAt.toISOString().slice(0, 10);
    const list = byDay.get(day);
    if (list) list.push(tx);
    else byDay.set(day, [tx]);
  }

  const cashRegisters = await prisma.cashRegister.findMany({ select: { id: true, date: true } });
  const registerByDay = new Map(cashRegisters.map((r) => [r.date.toISOString().slice(0, 10), r.id]));

  const salesRepo = new SalesPostingRepository(prisma);
  let dayCloseCount = 0;
  const dayCloseTotal = byDay.size;

  for (const day of [...byDay.keys()].sort()) {
    const txs = byDay.get(day)!;
    const inputs: DaySalesInput[] = txs.map((tx) => ({
      paymentMethod: tx.paymentMethod,
      cashAmount: tx.cashAmount,
      qrisAmount: tx.qrisAmount,
      totalAmount: tx.totalAmount,
      service: tx.tableSession.service,
    }));
    const { cashSales, qrisSales } = sumDaySales(inputs);
    const cashRegisterId = registerByDay.get(day) ?? `import-${day}`;

    try {
      // expectedCash === countedCash is deliberate — it suppresses the
      // selisih legs, which Warung Books has no concept of.
      const posted = await salesRepo.postDayClose({
        date: day,
        cashRegisterId,
        cashSales: BigInt(cashSales),
        qrisSales: BigInt(qrisSales),
        expectedCash: 0n,
        countedCash: 0n,
        tunaiAccount: "Assets:Cash:Warung",
        elektronikAccount: "Assets:Cash:Mandiri",
      });
      if (posted) dayCloseCount += 1;
    } catch (e) {
      rejections.push({ stage: `day-close ${day}`, input: { day, cashSales, qrisSales }, error: errMsg(e) });
    }
  }
  rowCounts["hari tutup kas diposting"] = dayCloseCount;
  rowCounts["hari dengan transaksi PAID"] = dayCloseTotal;

  // -----------------------------------------------------------------------
  // (d) Post the online settlements, after day-close, in ascending
  // settlement-date order. Online income is recognized at settlement (not
  // order time) — see settlementPostingRepository.ts's header comment.
  // -----------------------------------------------------------------------

  const settlementsToPost = [...backupSettlements]
    .map((s) => {
      const full = t.onlineSettlements.find((row) => row.id === s.id) as {
        id: string;
        service: string;
        settlementDate: string;
      };
      return full;
    })
    .filter((s) => withinCutoff(s.settlementDate))
    .sort((a, b) => (a.settlementDate < b.settlementDate ? -1 : a.settlementDate > b.settlementDate ? 1 : 0));

  const settlementRepo = new SettlementPostingRepository(prisma);
  const settlements: SettlementResult[] = [];

  for (const s of settlementsToPost) {
    const dbSettlement = backupSettlements.find((row) => row.id === s.id)!;
    const deductionRows = await prisma.settlementDeduction.findMany({ where: { settlementId: s.id } });
    const deductionsTotal = deductionRows.reduce((sum, d) => sum + d.amount, 0);
    const date = s.settlementDate.slice(0, 10);

    try {
      const posted = await settlementRepo.postSettlement({
        date,
        settlementId: s.id,
        service: s.service,
        totalGross: BigInt(dbSettlement.totalGross),
        commissionAmount: BigInt(dbSettlement.commissionAmount),
        deductionsTotal: BigInt(deductionsTotal),
        finalAmount: BigInt(dbSettlement.finalAmount),
        cashAccount: "Assets:Cash:Mandiri",
      });
      settlements.push({
        settlementId: s.id,
        service: s.service,
        date,
        adjustment: adjustmentBySettlement.get(s.id) ?? null,
        ok: true,
        journalEntryId: posted.journalEntryId,
      });
    } catch (e) {
      const message = errMsg(e);
      settlements.push({
        settlementId: s.id,
        service: s.service,
        date,
        adjustment: adjustmentBySettlement.get(s.id) ?? null,
        ok: false,
        error: message,
      });
      rejections.push({ stage: "settlement", input: s, error: message });
    }
  }
  rowCounts["settlement online diposting"] = settlements.filter((s) => s.ok).length;
  rowCounts["settlement online total"] = settlements.length;

  return { rowCounts, rejections, dayCloseCount, dayCloseTotal, settlements, excludedKomisi };
}
