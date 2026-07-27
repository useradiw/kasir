/**
 * Double-entry primitives: JournalLine and JournalEntry.
 *
 * Convention (mirrors Warung Books posting.py):
 *   amounts are bigint (whole Rupiah); positive = debit, negative = credit.
 *   Every JournalEntry's lines MUST sum to exactly 0n (zero-sum invariant).
 *
 * Account names are Beancount-style colon hierarchies, e.g.
 *   "Assets:Cash:Mandiri" | "Equity:Opening" | "Income:Sales:QRIS" |
 *   "Expenses:HPP:DAGING" | "Expenses:OpEx:GAJI"
 */

export interface JournalLine {
  account: string;
  /** Signed integer Rupiah. positive = debit, negative = credit. */
  amount: bigint;
}

export interface JournalEntryOptions {
  id?: string;
}

export class JournalEntry {
  readonly id: string | undefined;
  readonly date: string;
  readonly narration: string;
  readonly postings: readonly JournalLine[];

  constructor(
    date: string,
    narration: string,
    postings: JournalLine[],
    options?: JournalEntryOptions,
  ) {
    const total = postings.reduce((sum, p) => sum + p.amount, 0n);
    if (total !== 0n) {
      throw new Error(
        `JournalEntry does not balance (${date} '${narration}'): ` +
          `postings sum to ${total}, expected 0`,
      );
    }
    this.id = options?.id;
    this.date = date;
    this.narration = narration;
    this.postings = Object.freeze([...postings]);
  }

  balances(): boolean {
    return this.postings.reduce((sum, p) => sum + p.amount, 0n) === 0n;
  }
}
