/**
 * buku-kas.test.ts — getBukuKas (lib/buku-kas.ts), Slice 5.
 *
 * Entries are posted through the REAL repositories (AccountingRepository,
 * CashAccountRepository, CatatRepository), against pglite — not hand-inserted
 * rows — same style as test/statements.test.ts.
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { PrismaClient } from "@/generated/prisma";
import { AccountingRepository } from "../lib/accounting/accountingRepository";
import { CashAccountRepository } from "../lib/accounting/cashAccountRepository";
import { CatatRepository } from "../lib/accounting/catatRepository";
import { getBukuKas } from "../lib/buku-kas";
import { createTestClient, resetDb } from "./setup";

let prisma: PrismaClient;
let acc: AccountingRepository;
let cashRepo: CashAccountRepository;
let catat: CatatRepository;

const UTAMA = "Assets:Cash:Utama";

beforeAll(async () => {
  prisma = await createTestClient();
  acc = new AccountingRepository(prisma);
  cashRepo = new CashAccountRepository(prisma);
  catat = new CatatRepository(prisma);
});

afterEach(async () => {
  await resetDb(prisma);
});

describe("getBukuKas", () => {
  it("running saldo satisfies saldoAwal + sum(masuk) - sum(keluar) === saldoAkhir over a multi-entry month", async () => {
    await cashRepo.create("Utama");
    await catat.recordModal({ date: "2026-07-01", nama: "Adi", akun: UTAMA, jumlah: 1_000_000n });
    await acc.postEntry({
      date: "2026-07-05",
      narration: "Sale",
      lines: [{ account: UTAMA, amount: 300_000n }, { account: "Income:Sales:Tunai", amount: -300_000n }],
    });
    await acc.postEntry({
      date: "2026-07-10",
      narration: "Expense",
      lines: [{ account: "Expenses:OpEx:Listrik", amount: 50_000n }, { account: UTAMA, amount: -50_000n }],
    });

    const [row] = await getBukuKas("2026-07", prisma);
    expect(row).toBeDefined();
    const masuk = row!.movements.reduce((s, m) => s + m.masuk, 0);
    const keluar = row!.movements.reduce((s, m) => s + m.keluar, 0);
    expect(row!.saldoAwal + masuk - keluar).toBe(row!.saldoAkhir);
    expect(row!.saldoAkhir).toBe(1_000_000 + 300_000 - 50_000);
  });

  it("aggregates TWO legs on the SAME account within one entry into a single net movement (the donor .find() bug)", async () => {
    // Shaped exactly like a day-close with a cash shortage: Dr kas cashSales,
    // then Cr kas selisih — both legs on the SAME tunai account, one entry.
    await cashRepo.create("Utama");
    await acc.postEntry({
      date: "2026-07-05",
      narration: "Tutup kas 2026-07-05",
      lines: [
        { account: UTAMA, amount: 5_000_000n },
        { account: "Income:Sales:Tunai", amount: -5_000_000n },
        { account: "Expenses:SelisihKas", amount: 25_000n },
        { account: UTAMA, amount: -25_000n },
      ],
    });

    const [row] = await getBukuKas("2026-07", prisma);
    expect(row!.movements).toHaveLength(1);
    expect(row!.movements[0]!.masuk).toBe(4_975_000);
    expect(row!.movements[0]!.keluar).toBe(0);
    expect(row!.saldoAwal + row!.movements[0]!.masuk - row!.movements[0]!.keluar).toBe(row!.saldoAkhir);
    expect(row!.saldoAkhir).toBe(4_975_000);
  });

  it("saldoAwal excludes the period and reflects only prior entries; movements are date-ordered", async () => {
    await cashRepo.create("Utama");
    await catat.recordModal({ date: "2026-06-15", nama: "Adi", akun: UTAMA, jumlah: 200_000n });
    await acc.postEntry({
      date: "2026-07-20",
      narration: "Later",
      lines: [{ account: UTAMA, amount: 10_000n }, { account: "Income:Sales:Tunai", amount: -10_000n }],
    });
    await acc.postEntry({
      date: "2026-07-05",
      narration: "Earlier",
      lines: [{ account: UTAMA, amount: 20_000n }, { account: "Income:Sales:Tunai", amount: -20_000n }],
    });

    const [row] = await getBukuKas("2026-07", prisma);
    expect(row!.saldoAwal).toBe(200_000);
    expect(row!.movements.map((m) => m.date)).toEqual(["2026-07-05", "2026-07-20"]);
  });

  it("a voided entry and its reversal both appear and net to zero", async () => {
    await cashRepo.create("Utama");
    const posted = await acc.postEntry({
      date: "2026-07-05",
      narration: "Sale",
      lines: [{ account: UTAMA, amount: 300_000n }, { account: "Income:Sales:Tunai", amount: -300_000n }],
    });
    await acc.voidEntry(posted.id);

    const [row] = await getBukuKas("2026-07", prisma);
    expect(row!.movements).toHaveLength(2);
    const net = row!.movements.reduce((s, m) => s + m.masuk - m.keluar, 0);
    expect(net).toBe(0);
    expect(row!.saldoAkhir).toBe(row!.saldoAwal);
  });

  it("empty book / no cash accounts returns an empty array without throwing", async () => {
    const rows = await getBukuKas("2026-07", prisma);
    expect(rows).toEqual([]);
  });
});
