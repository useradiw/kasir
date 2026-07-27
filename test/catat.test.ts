/**
 * catat.test.ts — CatatRepository (Transfer / Modal / Prive / Saldo Awal).
 * Each vertical posts a balanced JE through the ledger engine; edit = void +
 * repost; hapus = void. tokokencana-native (no storeId / control plane).
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { PrismaClient } from "@/generated/prisma";
import { CatatRepository, SameAccountError, InvalidCatatError } from "../lib/accounting/catatRepository";
import { AccountingRepository } from "../lib/accounting/accountingRepository";
import { createTestClient, resetDb } from "./setup";

let prisma: PrismaClient;
let catat: CatatRepository;
let acc: AccountingRepository;

const UTAMA = "Assets:Cash:Utama";
const KECIL = "Assets:Cash:Kecil";

beforeAll(async () => {
  prisma = await createTestClient();
  catat = new CatatRepository(prisma);
  acc = new AccountingRepository(prisma);
});

afterEach(async () => {
  await resetDb(prisma);
});

describe("transfer antar kas", () => {
  it("posts Dr ke / Cr dari, balanced", async () => {
    const row = await catat.recordTransfer({ date: "2026-07-01", dari: UTAMA, ke: KECIL, jumlah: 100_000n });
    expect(row.sourceType).toBe("transfer");

    const book = await acc.loadBook();
    expect(book.balance(KECIL)).toBe(100_000n);
    expect(book.balance(UTAMA)).toBe(-100_000n);
    expect(book.equationResidual()).toBe(0n);
  });

  it("rejects same source and destination", async () => {
    await expect(
      catat.recordTransfer({ date: "2026-07-01", dari: UTAMA, ke: UTAMA, jumlah: 100_000n }),
    ).rejects.toThrow(SameAccountError);
  });

  it("rejects a non-kas account", async () => {
    await expect(
      catat.recordTransfer({ date: "2026-07-01", dari: UTAMA, ke: "Income:Sales:Tunai", jumlah: 100_000n }),
    ).rejects.toThrow(InvalidCatatError);
  });
});

describe("setoran modal", () => {
  it("posts Dr kas / Cr Equity:Modal", async () => {
    await catat.recordModal({ date: "2026-07-02", nama: "Adi", akun: UTAMA, jumlah: 5_000_000n });
    const book = await acc.loadBook();
    expect(book.balance(UTAMA)).toBe(5_000_000n);
    expect(book.balance("Equity:Modal")).toBe(-5_000_000n);
  });

  it("requires a penyetor name", async () => {
    await expect(
      catat.recordModal({ date: "2026-07-02", nama: "  ", akun: UTAMA, jumlah: 1_000n }),
    ).rejects.toThrow(InvalidCatatError);
  });
});

describe("prive", () => {
  it("posts Dr Equity:Prive / Cr kas", async () => {
    await catat.recordPrive({ date: "2026-07-03", akun: UTAMA, jumlah: 200_000n });
    const book = await acc.loadBook();
    expect(book.balance("Equity:Prive")).toBe(200_000n);
    expect(book.balance(UTAMA)).toBe(-200_000n);
  });
});

describe("saldo awal", () => {
  it("posts Dr kas / Cr Equity:Opening and flags no prior entries", async () => {
    const { row, hasPriorEntries } = await catat.recordSaldoAwal({ date: "2026-07-01", akun: UTAMA, jumlah: 1_000_000n });
    expect(row.sourceType).toBe("saldo-awal");
    expect(hasPriorEntries).toBe(false);
    const book = await acc.loadBook();
    expect(book.balance(UTAMA)).toBe(1_000_000n);
    expect(book.balance("Equity:Opening")).toBe(-1_000_000n);
  });

  it("flags hasPriorEntries when an earlier POSTED entry exists", async () => {
    await catat.recordModal({ date: "2026-06-30", nama: "Adi", akun: UTAMA, jumlah: 50_000n });
    const { hasPriorEntries } = await catat.recordSaldoAwal({ date: "2026-07-01", akun: KECIL, jumlah: 10_000n });
    expect(hasPriorEntries).toBe(true);
  });
});

describe("edit + hapus", () => {
  it("edit voids the original and reposts (net balance reflects the new amount)", async () => {
    const row = await catat.recordPrive({ date: "2026-07-03", akun: UTAMA, jumlah: 200_000n });
    const edited = await catat.editCatat(row.id, "prive", { date: "2026-07-03", akun: UTAMA, jumlah: 300_000n });
    expect(edited.replacesId).toBe(row.id);

    const book = await acc.loadBook();
    // original 200k (VOID) + reversal -200k + new 300k = 300k
    expect(book.balance("Equity:Prive")).toBe(300_000n);

    const original = await prisma.journalEntry.findUniqueOrThrow({ where: { id: row.id } });
    expect(original.state).toBe("VOID");
  });

  it("hapus voids the entry (net zero)", async () => {
    const row = await catat.recordModal({ date: "2026-07-02", nama: "Adi", akun: UTAMA, jumlah: 500_000n });
    await catat.voidCatat(row.id, "modal");
    const book = await acc.loadBook();
    expect(book.balance("Equity:Modal")).toBe(0n);
    expect(book.balance(UTAMA)).toBe(0n);
  });
});

describe("listCatat", () => {
  it("lists non-void entries of one sourceType, newest first", async () => {
    await catat.recordModal({ date: "2026-07-01", nama: "Adi", akun: UTAMA, jumlah: 100n });
    await catat.recordModal({ date: "2026-07-05", nama: "Budi", akun: UTAMA, jumlah: 200n });
    await catat.recordPrive({ date: "2026-07-03", akun: UTAMA, jumlah: 50n });

    const modal = await catat.listCatat("modal");
    expect(modal).toHaveLength(2);
    expect(modal[0]?.date).toBe("2026-07-05"); // newest first
    const prive = await catat.listCatat("prive");
    expect(prive).toHaveLength(1);
  });
});
