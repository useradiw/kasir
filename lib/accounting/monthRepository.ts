/**
 * monthRepository.ts — accounting months (Bulan) the user creates + picks.
 * Warung Books hardcoded its months; here they are a managed, additive list.
 * `lockedAt` backs Slice 5 tutup buku (month lock) — not enforced yet.
 */

import { PrismaClient, Prisma } from "@/generated/prisma";
import { DomainError } from "../errors";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export class InvalidMonthError extends DomainError {
  constructor(m: string) {
    super(`Bulan "${m}" tidak valid — gunakan format YYYY-MM.`);
    this.name = "InvalidMonthError";
  }
}

export interface MonthRow {
  month: string; // "YYYY-MM"
  locked: boolean;
}

/** S25c/Slice 5: lock() targets a month that hasn't been created via `create()`. */
export class MonthNotFoundError extends DomainError {
  constructor(month: string) {
    super(`Bulan "${month}" belum dibuat — buat bulannya dulu sebelum menguncinya.`);
    this.name = "MonthNotFoundError";
  }
}

export class MonthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(): Promise<MonthRow[]> {
    const rows = await this.prisma.accountingMonth.findMany({ orderBy: { month: "desc" } });
    return rows.map((r) => ({ month: r.month, locked: r.lockedAt !== null }));
  }

  /** Create a month (idempotent — returns the existing row on re-create). */
  async create(month: string): Promise<MonthRow> {
    if (!MONTH_RE.test(month)) throw new InvalidMonthError(month);
    try {
      const row = await this.prisma.accountingMonth.create({ data: { month } });
      return { month: row.month, locked: row.lockedAt !== null };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const row = await this.prisma.accountingMonth.findUniqueOrThrow({ where: { month } });
        return { month: row.month, locked: row.lockedAt !== null };
      }
      throw e;
    }
  }

  /**
   * Lock (tutup buku) a month — idempotent. The month must already exist
   * (created via `create()`); locking does NOT implicitly create it.
   */
  async lock(month: string): Promise<MonthRow> {
    if (!MONTH_RE.test(month)) throw new InvalidMonthError(month);
    const existing = await this.prisma.accountingMonth.findUnique({ where: { month } });
    if (!existing) throw new MonthNotFoundError(month);
    const row = await this.prisma.accountingMonth.update({
      where: { month },
      data: { lockedAt: existing.lockedAt ?? new Date() },
    });
    return { month: row.month, locked: row.lockedAt !== null };
  }

  /** Unlock (buka kembali) a month — idempotent. */
  async unlock(month: string): Promise<MonthRow> {
    if (!MONTH_RE.test(month)) throw new InvalidMonthError(month);
    const existing = await this.prisma.accountingMonth.findUnique({ where: { month } });
    if (!existing) throw new MonthNotFoundError(month);
    const row = await this.prisma.accountingMonth.update({
      where: { month },
      data: { lockedAt: null },
    });
    return { month: row.month, locked: row.lockedAt !== null };
  }

  async isLocked(month: string): Promise<boolean> {
    if (!MONTH_RE.test(month)) throw new InvalidMonthError(month);
    const row = await this.prisma.accountingMonth.findUnique({ where: { month } });
    return row?.lockedAt !== null && row?.lockedAt !== undefined;
  }
}
