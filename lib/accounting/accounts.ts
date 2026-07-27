/**
 * Chart of accounts helpers (mirrors Warung Books accounts.py).
 *
 * Root types and their natural balance sign:
 *   Assets      [debit]   normally positive (debit - credit)
 *   Expenses    [debit]   normally positive
 *   Equity      [credit]  normally negative
 *   Income      [credit]  normally negative
 *   Liabilities [credit]  normally negative
 */

export const ROOT_TYPES: Readonly<Record<string, string>> = {
  Assets: "Asset",
  Liabilities: "Liability",
  Equity: "Equity",
  Income: "Income",
  Expenses: "Expense",
};

export const CASH_ACCOUNTS = {
  mandiri: "Assets:Cash:Mandiri",
  pak_har: "Assets:Cash:PakHar",
  warung: "Assets:Cash:Warung",
} as const satisfies Readonly<Record<string, string>>;

export const CASH_LABELS: Readonly<Record<string, string>> = {
  "Assets:Cash:Mandiri": "Kas Utama (Bank Mandiri)",
  "Assets:Cash:PakHar": "Kas Pak Har (Belanja)",
  "Assets:Cash:Warung": "Kas Kecil (Warung)",
};

/**
 * Accounts used to post kas selisih (cash-count variance) legs at POS
 * session close (Slice 23a). Short (counted < expected) hits the expense
 * account; over (counted > expected) hits the income account.
 */
export const SELISIH_ACCOUNTS: Readonly<{ expense: string; income: string }> = {
  expense: "Expenses:SelisihKas",
  income: "Income:SelisihKas",
};

/**
 * Accounts used to post kas masuk/keluar (POS shift cash moves) legs at
 * record time (TD-49). Kas keluar hits the expense account; kas masuk hits
 * the income account.
 */
export const CASH_MOVE_ACCOUNTS: Readonly<{ expense: string; income: string }> = {
  expense: "Expenses:KasKeluar",
  income: "Income:KasMasuk",
};

/**
 * Account for the explicit discount contra-line posted at day-close (TD-26).
 * Covers ALL tx-level discounts on the session's non-void transactions —
 * voucher-redeemed and manually-entered discounts are not currently
 * distinguishable on PosTransaction, so both post here.
 */
export const DISCOUNT_ACCOUNT = "Expenses:Diskon";

/**
 * Deterministic account-name segment for a new key.
 * "kas_baru" -> "KasBaru"
 */
function titleCaseKey(key: string): string {
  const parts = key.replace(/-/g, "_").split("_").filter(Boolean);
  if (parts.length === 0) return "Lain";
  return parts.map((p) => (p[0] ?? "").toUpperCase() + p.slice(1).toLowerCase()).join("");
}

/**
 * Ledger account name for a cash-account key. The three original keys keep
 * their canonical names; any other key maps to Assets:Cash:<TitleCasedKey>.
 */
export function accountForKey(key: string): string {
  if (key in CASH_ACCOUNTS) {
    return CASH_ACCOUNTS[key as keyof typeof CASH_ACCOUNTS];
  }
  return `Assets:Cash:${titleCaseKey(key)}`;
}

// ---------------------------------------------------------------------------
// Kas account registry (S25b, decision 5) — StoreSettings.cashAccounts Json
// ---------------------------------------------------------------------------

export interface CashAccountEntry {
  /** Stable key, e.g. "mandiri", "pak_har", "warung", "kas_baru". */
  key: string;
  /** Human label shown in dropdowns, e.g. "Kas Pak Har (Belanja)". */
  label: string;
  /** Inactive accounts are hidden from dropdowns; never deleted. */
  active: boolean;
}

/** Canonical default registry — mirrors CASH_ACCOUNTS/CASH_LABELS. */
export const DEFAULT_CASH_ACCOUNTS: readonly CashAccountEntry[] = [
  { key: "mandiri", label: "Kas Utama (Bank Mandiri)", active: true },
  { key: "pak_har", label: "Kas Pak Har (Belanja)", active: true },
  { key: "warung", label: "Kas Kecil (Warung)", active: true },
];

export function isValidCashAccounts(v: unknown): v is CashAccountEntry[] {
  if (!Array.isArray(v) || v.length === 0) return false;
  const seen = new Set<string>();
  for (const item of v) {
    if (typeof item !== "object" || item === null) return false;
    const o = item as Record<string, unknown>;
    const key = o["key"];
    const label = o["label"];
    if (typeof key !== "string" || !key.trim()) return false;
    if (typeof label !== "string" || !label.trim()) return false;
    if (typeof o["active"] !== "boolean") return false;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

/**
 * Return the root type ('Asset', 'Income', ...) for an account name.
 */
export function rootType(account: string): string {
  const top = account.split(":", 1)[0] ?? "";
  return ROOT_TYPES[top] ?? "Unknown";
}
