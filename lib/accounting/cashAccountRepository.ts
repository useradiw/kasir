/**
 * cashAccountRepository.ts — freely-creatable kas/bank accounts (Slice 1).
 *
 * Cash accounts are LedgerAccount rows of type ASSET under the "Assets:Cash:*"
 * Beancount namespace. There is NO hardcoded cash list — the user creates their
 * own (Kas Laci, Bank BCA, …) and every kas dropdown reads the active set here.
 *
 * Invariant: the Beancount `name` is embedded verbatim in posted journal lines,
 * so it is IMMUTABLE after creation. Renaming edits the display `label` only,
 * never `name` — ledger history stays intact.
 */

import { PrismaClient, Prisma } from "@/generated/prisma";
import { DomainError } from "../errors";

const CASH_PREFIX = "Assets:Cash:";

export class InvalidCashAccountError extends DomainError {
  constructor(reason: string) {
    super(reason);
    this.name = "InvalidCashAccountError";
  }
}

export class CashAccountNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Akun kas "${id}" tidak ditemukan.`);
    this.name = "CashAccountNotFoundError";
  }
}

export interface CashAccountRow {
  id: string;
  /** Beancount name, e.g. "Assets:Cash:BankBca". */
  name: string;
  /** Friendly display label — always present (falls back to the last segment). */
  label: string;
  code: string;
  active: boolean;
}

/** "Bank BCA!" -> "BankBCA"; "kas laci" -> "KasLaci". Beancount segment (no spaces). */
function toSegment(label: string): string {
  const words = label
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const seg = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
  return seg;
}

/** "Bank BCA" -> "bank-bca". */
function toKebab(label: string): string {
  return label
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join("-");
}

function displayLabel(row: { name: string; label: string | null }): string {
  if (row.label && row.label.trim()) return row.label;
  return row.name.split(":").at(-1) ?? row.name;
}

export class CashAccountRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(includeInactive = false): Promise<CashAccountRow[]> {
    const rows = await this.prisma.ledgerAccount.findMany({
      where: {
        name: { startsWith: CASH_PREFIX },
        ...(includeInactive ? {} : { active: true }),
      },
      orderBy: { name: "asc" },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      label: displayLabel(r),
      code: r.code,
      active: r.active,
    }));
  }

  /**
   * Create a kas account from a friendly label. Derives a unique Beancount name
   * ("Assets:Cash:<Segment>") and code ("cash-<kebab>"), suffixing on collision.
   */
  async create(label: string): Promise<CashAccountRow> {
    const trimmed = label.trim();
    if (!trimmed) throw new InvalidCashAccountError("Nama akun kas wajib diisi.");
    const segment = toSegment(trimmed);
    if (!segment) throw new InvalidCashAccountError("Nama akun kas tidak valid.");
    const kebab = toKebab(trimmed) || "kas";

    // Find a free suffix across both unique keys (name + code).
    for (let n = 0; n < 50; n++) {
      const suffix = n === 0 ? "" : String(n + 1);
      const name = `${CASH_PREFIX}${segment}${suffix}`;
      const code = `cash-${kebab}${n === 0 ? "" : `-${n + 1}`}`;
      try {
        const row = await this.prisma.ledgerAccount.create({
          data: { code, name, label: trimmed, type: "ASSET" },
        });
        return { id: row.id, name: row.name, label: displayLabel(row), code: row.code, active: row.active };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          continue; // name or code taken — try the next suffix
        }
        throw e;
      }
    }
    throw new InvalidCashAccountError("Tidak bisa membuat akun kas — nama bentrok terus.");
  }

  /** Rename the DISPLAY label only. The Beancount `name` never changes. */
  async rename(id: string, label: string): Promise<CashAccountRow> {
    const trimmed = label.trim();
    if (!trimmed) throw new InvalidCashAccountError("Nama akun kas wajib diisi.");
    const existing = await this.prisma.ledgerAccount.findUnique({ where: { id } });
    if (!existing || !existing.name.startsWith(CASH_PREFIX)) {
      throw new CashAccountNotFoundError(id);
    }
    const row = await this.prisma.ledgerAccount.update({ where: { id }, data: { label: trimmed } });
    return { id: row.id, name: row.name, label: displayLabel(row), code: row.code, active: row.active };
  }

  async setActive(id: string, active: boolean): Promise<CashAccountRow> {
    const existing = await this.prisma.ledgerAccount.findUnique({ where: { id } });
    if (!existing || !existing.name.startsWith(CASH_PREFIX)) {
      throw new CashAccountNotFoundError(id);
    }
    const row = await this.prisma.ledgerAccount.update({ where: { id }, data: { active } });
    return { id: row.id, name: row.name, label: displayLabel(row), code: row.code, active: row.active };
  }
}
