/**
 * buku-kas.ts — Buku Kas (cash-account ledger view) + Cek Saldo (Slice 5).
 *
 * Ported from tokokencana's lib/queries/keuangan.ts, section
 * "Slice 5 — Buku Kas + Cek Saldo" (getBukuKas / getCekSaldo).
 *
 * ☠ CRITICAL ADAPTATION vs the donor: the donor does
 *   `entry.lines.find((l) => l.account === acc.name)` — ONE line per entry.
 * kasir's day-close entry can post TWO legs on the SAME kas account within one
 * entry (see salesPostingRepository.buildLines: `Dr <tunai> cashSales` and,
 * when the drawer is short, `Cr <tunai> selisih` — the same account on both
 * lines). With `.find()`, only the FIRST leg is counted, so the running saldo
 * would show the gross cash sales and silently disagree with saldoAkhir
 * (which comes from `book.balance` and correctly sums ALL lines on the
 * account). Fixed here by AGGREGATING every line on the account within an
 * entry and emitting ONE movement per entry using the net. Entries whose net
 * on this account is 0 are skipped entirely (e.g. an entry that touches other
 * accounts but not this one, or two legs on this account that cancel out).
 * Invariant proved in test/buku-kas.test.ts:
 *   saldoAwal + sum(masuk) - sum(keluar) === saldoAkhir
 */

import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma";
import { AccountingRepository } from "@/lib/accounting/accountingRepository";
import { CashAccountRepository } from "@/lib/accounting/cashAccountRepository";
import { BalanceAssertionRepository } from "@/lib/accounting/balanceAssertionRepository";
import { monthRange } from "@/lib/keuangan-month";

/** Amounts fit safely in Number (Rupiah < 2^53); convert at the read boundary
 *  so BigInt never crosses the server/client serialization seam. */
const n = (b: bigint) => Number(b);

/** "YYYY-MM-DD" minus one day, UTC-safe. */
function previousDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export interface BukuKasMovement {
  date: string;
  number: number | null;
  narration: string;
  masuk: number;
  keluar: number;
  saldo: number;
}

export interface BukuKasAccount {
  account: string;
  label: string;
  saldoAwal: number;
  movements: BukuKasMovement[];
  saldoAkhir: number;
}

/**
 * Per active cash account: saldo awal (balance strictly before the month),
 * the period's movements in date order (running saldo, masuk/keluar derived
 * from AGGREGATING every line this account has within each entry — never a
 * single `.find()`, see the module doc comment), and saldo akhir. Movements
 * include both POSTED and VOID entries (a void's reversal nets the original
 * to zero in the running balance, same convention as
 * AccountingRepository.loadBook).
 */
export async function getBukuKas(month: string, db: PrismaClient = prisma): Promise<BukuKasAccount[]> {
  const { dateFrom, dateTo } = monthRange(month);
  const accounts = await new CashAccountRepository(db).list();
  if (accounts.length === 0) return [];

  const book = await new AccountingRepository(db).loadBook({ dateTo });
  const dayBeforeFrom = previousDay(dateFrom);

  const periodEntries = await db.journalEntry.findMany({
    where: { state: { in: ["POSTED", "VOID"] }, date: { gte: dateFrom, lte: dateTo } },
    include: { lines: true },
    orderBy: [{ date: "asc" }, { number: "asc" }],
  });

  return accounts.map((acc) => {
    const saldoAwal = book.balance(acc.name, undefined, dayBeforeFrom);
    let running = saldoAwal;
    const movements: BukuKasMovement[] = [];
    for (const entry of periodEntries) {
      // Aggregate EVERY line on this account within the entry — a single
      // entry can carry more than one leg on the same account (e.g. tutup
      // kas: cashSales debit + selisih credit, both on the same kas laci).
      const net = entry.lines.reduce(
        (sum, l) => (l.account === acc.name ? sum + l.amount : sum),
        0n,
      );
      if (net === 0n) continue;
      running += net;
      movements.push({
        date: entry.date,
        number: entry.number,
        narration: entry.narration,
        masuk: n(net > 0n ? net : 0n),
        keluar: n(net < 0n ? -net : 0n),
        saldo: n(running),
      });
    }
    const saldoAkhir = book.balance(acc.name, undefined, dateTo);
    return {
      account: acc.name,
      label: acc.label,
      saldoAwal: n(saldoAwal),
      movements,
      saldoAkhir: n(saldoAkhir),
    };
  });
}

export interface CekSaldoRow {
  account: string;
  label: string;
  saldoLedger: number;
  saldoTercatat: number | null;
  selisih: number | null;
  tanggalTercatat: string | null;
  note: string | null;
}

/**
 * Per active cash account: posted ledger balance through the month's last
 * day vs the latest physically-counted assertion at/through that date.
 * saldoTercatat/selisih are null when the account has never been asserted —
 * that is NOT the same as a zero-drift assertion, so it must never be
 * coerced to 0.
 */
export async function getCekSaldo(month: string, db: PrismaClient = prisma): Promise<CekSaldoRow[]> {
  const { dateTo } = monthRange(month);
  const accounts = await new CashAccountRepository(db).list();
  if (accounts.length === 0) return [];

  const [book, assertions] = await Promise.all([
    new AccountingRepository(db).loadBook({ dateTo }),
    new BalanceAssertionRepository(db).listForDate(dateTo),
  ]);
  const byAccount = new Map(assertions.map((a) => [a.account, a]));

  return accounts.map((acc) => {
    const saldoLedger = book.balance(acc.name, undefined, dateTo);
    const assertion = byAccount.get(acc.name);
    const selisih = assertion ? saldoLedger - assertion.expected : null;
    return {
      account: acc.name,
      label: acc.label,
      saldoLedger: n(saldoLedger),
      saldoTercatat: assertion ? n(assertion.expected) : null,
      selisih: selisih !== null ? n(selisih) : null,
      tanggalTercatat: assertion?.date ?? null,
      note: assertion?.note ?? null,
    };
  });
}
