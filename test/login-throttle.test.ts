/**
 * login-throttle.test.ts — checkLock / recordFailure / clearFailures.
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { PrismaClient } from "@/generated/prisma";
import {
  checkLock,
  recordFailure,
  clearFailures,
  lockedMessage,
  MAX_FAILED_ATTEMPTS,
  LOCK_WINDOW_MINUTES,
} from "../lib/login-throttle";
import { createTestClient } from "./setup";

let prisma: PrismaClient;

// Mutable fake clock — no test sleeps.
let now: Date;
const clock = () => now;

beforeAll(async () => {
  // login_attempts is part of the init migration since 2026-09-02, so the
  // rig creates it; no extra DDL needed here.
  prisma = await createTestClient();
});

afterEach(async () => {
  await prisma.loginAttempt.deleteMany();
});

describe("recordFailure / checkLock", () => {
  it("four failures do not lock", async () => {
    now = new Date("2026-09-01T10:00:00Z");
    for (let i = 0; i < 4; i++) {
      await recordFailure("cashier1", prisma, clock);
    }
    expect(await checkLock("cashier1", prisma, clock)).toEqual({ locked: false });
  });

  it("the fifth failure locks for 15 minutes", async () => {
    now = new Date("2026-09-01T10:00:00Z");
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      await recordFailure("cashier2", prisma, clock);
    }
    const state = await checkLock("cashier2", prisma, clock);
    expect(state).toEqual({ locked: true, minutesLeft: 15 });
  });

  it("minutesLeft counts down and is 1 (never 0) just before expiry", async () => {
    now = new Date("2026-09-01T10:00:00Z");
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      await recordFailure("cashier3", prisma, clock);
    }

    now = new Date(now.getTime() + 10 * 60_000); // 10 min in, 5 left
    expect(await checkLock("cashier3", prisma, clock)).toEqual({ locked: true, minutesLeft: 5 });

    now = new Date(
      new Date("2026-09-01T10:00:00Z").getTime() + LOCK_WINDOW_MINUTES * 60_000 - 1_000,
    ); // 1 second before expiry
    expect(await checkLock("cashier3", prisma, clock)).toEqual({ locked: true, minutesLeft: 1 });
  });

  it("after 15 minutes the lock expires", async () => {
    now = new Date("2026-09-01T10:00:00Z");
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      await recordFailure("cashier4", prisma, clock);
    }

    now = new Date(now.getTime() + LOCK_WINDOW_MINUTES * 60_000);
    expect(await checkLock("cashier4", prisma, clock)).toEqual({ locked: false });
  });

  it("after an expired lock, the next failure restarts the count at 1 and does not immediately re-lock", async () => {
    now = new Date("2026-09-01T10:00:00Z");
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      await recordFailure("cashier5", prisma, clock);
    }

    now = new Date(now.getTime() + LOCK_WINDOW_MINUTES * 60_000 + 1_000); // lock expired
    await recordFailure("cashier5", prisma, clock);

    const row = await prisma.loginAttempt.findUnique({ where: { username: "cashier5" } });
    expect(row?.failedCount).toBe(1);
    expect(await checkLock("cashier5", prisma, clock)).toEqual({ locked: false });
  });

  it("clearFailures after 3 failures resets the counter", async () => {
    now = new Date("2026-09-01T10:00:00Z");
    for (let i = 0; i < 3; i++) {
      await recordFailure("cashier6", prisma, clock);
    }
    await clearFailures("cashier6", prisma);

    for (let i = 0; i < 4; i++) {
      await recordFailure("cashier6", prisma, clock);
    }
    expect(await checkLock("cashier6", prisma, clock)).toEqual({ locked: false });
  });

  it("clearFailures on a username with no row does not throw", async () => {
    await expect(clearFailures("nobody", prisma)).resolves.not.toThrow();
  });

  // Symmetry between a known and an unknown username is what keeps the
  // account-enumeration leak closed: recordFailure has no idea which is
  // which, so their stored state after the same sequence must be identical.
  it("an unknown username locks on exactly the same schedule as a known one", async () => {
    now = new Date("2026-09-01T10:00:00Z");
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      await recordFailure("real-staff", prisma, clock);
      await recordFailure("totally-made-up-name", prisma, clock);
    }

    const real = await prisma.loginAttempt.findUnique({ where: { username: "real-staff" } });
    const fake = await prisma.loginAttempt.findUnique({
      where: { username: "totally-made-up-name" },
    });

    expect(real?.failedCount).toBe(fake?.failedCount);
    expect(real?.lockedUntil?.getTime()).toBe(fake?.lockedUntil?.getTime());
  });
});

describe("lockedMessage", () => {
  it("formats the Indonesian lockout message", () => {
    expect(lockedMessage(15)).toBe("Terlalu banyak percobaan. Coba lagi dalam 15 menit.");
  });
});
