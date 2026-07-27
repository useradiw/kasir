/**
 * month.test.ts — MonthRepository (accounting months / Bulan).
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { PrismaClient } from "@/generated/prisma";
import { MonthRepository, InvalidMonthError } from "../lib/accounting/monthRepository";
import { createTestClient, resetDb } from "./setup";

let prisma: PrismaClient;
let repo: MonthRepository;

beforeAll(async () => {
  prisma = await createTestClient();
  repo = new MonthRepository(prisma);
});

afterEach(async () => {
  await prisma.$executeRaw`TRUNCATE TABLE accounting_months CASCADE`;
  await resetDb(prisma);
});

describe("MonthRepository", () => {
  it("creates months and lists them newest-first", async () => {
    await repo.create("2026-06");
    await repo.create("2026-08");
    await repo.create("2026-07");
    const rows = await repo.list();
    expect(rows.map((r) => r.month)).toEqual(["2026-08", "2026-07", "2026-06"]);
    expect(rows.every((r) => r.locked === false)).toBe(true);
  });

  it("is idempotent on duplicate create", async () => {
    await repo.create("2026-07");
    await repo.create("2026-07");
    expect(await repo.list()).toHaveLength(1);
  });

  it("rejects a malformed month", async () => {
    await expect(repo.create("2026-13")).rejects.toThrow(InvalidMonthError);
    await expect(repo.create("2026/07")).rejects.toThrow(InvalidMonthError);
    await expect(repo.create("juli")).rejects.toThrow(InvalidMonthError);
  });
});
