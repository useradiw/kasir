/**
 * Book: in-memory ledger view with date-filtered balance queries.
 * Mirrors Warung Books book.py (Book class).
 *
 * Date filter is inclusive string comparison on ISO "YYYY-MM-DD" dates.
 * Balances = SUM of matching posting amounts (bigint).
 */

import { JournalEntry } from "./posting";

export class Book {
  readonly transactions: readonly JournalEntry[];

  constructor(transactions: JournalEntry[]) {
    this.transactions = Object.freeze([...transactions]);
  }

  // ----------------------------------------------------------------- private
  private inRange(
    date: string,
    dateFrom: string | undefined,
    dateTo: string | undefined,
  ): boolean {
    if (dateFrom !== undefined && date < dateFrom) return false;
    if (dateTo !== undefined && date > dateTo) return false;
    return true;
  }

  // ------------------------------------------------------------- queries
  /**
   * Exact-match account balance (debit minus credit), optionally date-filtered.
   */
  balance(
    account: string,
    dateFrom?: string,
    dateTo?: string,
  ): bigint {
    let sum = 0n;
    for (const t of this.transactions) {
      if (!this.inRange(t.date, dateFrom, dateTo)) continue;
      for (const p of t.postings) {
        if (p.account === account) sum += p.amount;
      }
    }
    return sum;
  }

  /**
   * Aggregate balance for all accounts starting with `prefix`,
   * optionally restricted to [dateFrom, dateTo] (inclusive).
   */
  balancePrefix(
    prefix: string,
    dateFrom?: string,
    dateTo?: string,
  ): bigint {
    let sum = 0n;
    for (const t of this.transactions) {
      if (!this.inRange(t.date, dateFrom, dateTo)) continue;
      for (const p of t.postings) {
        if (p.account.startsWith(prefix)) sum += p.amount;
      }
    }
    return sum;
  }

  /**
   * Sorted unique list of account names, optionally filtered by prefix.
   */
  accounts(prefix = ""): string[] {
    const seen = new Set<string>();
    for (const t of this.transactions) {
      for (const p of t.postings) {
        if (p.account.startsWith(prefix)) seen.add(p.account);
      }
    }
    return [...seen].sort();
  }

  /**
   * True if every transaction individually balances.
   */
  allBalance(): boolean {
    return this.transactions.every((t) => t.balances());
  }

  /**
   * Sum of every posting (over the range). Zero for a consistent book.
   */
  equationResidual(dateFrom?: string, dateTo?: string): bigint {
    let sum = 0n;
    for (const t of this.transactions) {
      if (!this.inRange(t.date, dateFrom, dateTo)) continue;
      for (const p of t.postings) {
        sum += p.amount;
      }
    }
    return sum;
  }
}
