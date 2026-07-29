/**
 * cek-saldo.test.ts — getCekSaldo (lib/buku-kas.ts), Slice 5.
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { PrismaClient } from "@/generated/prisma";
import { AccountingRepository } from "../lib/accounting/accountingRepository";
import { CashAccountRepository } from "../lib/accounting/cashAccountRepository";
import { BalanceAssertionRepository } from "../lib/accounting/balanceAssertionRepository";
import { getCekSaldo } from "../lib/buku-kas";
import { createTestClient, resetDb } from "./setup";

let prisma: PrismaClient;
let acc: AccountingRepository;
let cashRepo: CashAccountRepository;
let assertions: BalanceAssertionRepository;

const UTAMA = "Assets:Cash:Utama";

beforeAll(async () => {
  prisma = await createTestClient();
  acc = new AccountingRepository(prisma);
  cashRepo = new CashAccountRepository(prisma);
  assertions = new BalanceAssertionRepository(prisma);
});

afterEach(async () => {
  await resetDb(prisma);
});

describe("getCekSaldo", () => {
  it("a never-asserted account has saldoTercatat === null and selisih === null (NOT 0)", async () => {
    await cashRepo.create("Utama");
    await acc.postEntry({
      date: "2026-07-05",
      narration: "Sale",
      lines: [{ account: UTAMA, amount: 500_000n }, { account: "Income:Sales:Tunai", amount: -500_000n }],
    });

    const [row] = await getCekSaldo("2026-07", prisma);
    expect(row!.saldoLedger).toBe(500_000);
    expect(row!.saldoTercatat).toBeNull();
    expect(row!.selisih).toBeNull();
  });

  it("after recording a count below the ledger balance, selisih is the signed difference and tanggalTercatat/note come through", async () => {
    await cashRepo.create("Utama");
    await acc.postEntry({
      date: "2026-07-05",
      narration: "Sale",
      lines: [{ account: UTAMA, amount: 500_000n }, { account: "Income:Sales:Tunai", amount: -500_000n }],
    });
    await assertions.record({
      account: UTAMA,
      date: "2026-07-31",
      expected: 480_000n,
      note: "hitung ulang",
      createdBy: "staff-1",
    });

    const [row] = await getCekSaldo("2026-07", prisma);
    expect(row!.saldoLedger).toBe(500_000);
    expect(row!.saldoTercatat).toBe(480_000);
    expect(row!.selisih).toBe(20_000); // ledger - counted = surplus in the ledger
    expect(row!.tanggalTercatat).toBe("2026-07-31");
    expect(row!.note).toBe("hitung ulang");
  });

  it("the latest assertion at/through the month end wins when several exist", async () => {
    await cashRepo.create("Utama");
    await assertions.record({ account: UTAMA, date: "2026-07-10", expected: 100_000n, createdBy: "staff-1" });
    await assertions.record({ account: UTAMA, date: "2026-07-20", expected: 200_000n, createdBy: "staff-1" });
    await assertions.record({ account: UTAMA, date: "2026-08-05", expected: 999_000n, createdBy: "staff-1" });

    const [row] = await getCekSaldo("2026-07", prisma);
    // 2026-08-05 is after the month's dateTo (2026-07-31), so it must not win.
    expect(row!.saldoTercatat).toBe(200_000);
    expect(row!.tanggalTercatat).toBe("2026-07-20");
  });

  it("empty book / no cash accounts returns an empty array without throwing", async () => {
    const rows = await getCekSaldo("2026-07", prisma);
    expect(rows).toEqual([]);
  });
});
