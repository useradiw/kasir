/**
 * login-throttle.ts — brute-force lockout for the staff login form.
 *
 * Keyed by the raw username string (see the LoginAttempt model's doc comment
 * in schema.prisma) so an unknown username locks on exactly the same
 * schedule as a real one, closing the account-enumeration gap that a
 * username-shaped lockout would otherwise open.
 */

import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma";

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_WINDOW_MINUTES = 15;

type Clock = () => Date;

export type LockState = { locked: false } | { locked: true; minutesLeft: number };

export async function checkLock(
  username: string,
  db: PrismaClient = prisma,
  now: Clock = () => new Date(),
): Promise<LockState> {
  // Raw exact-string match, no lowercasing/trimming — must match how
  // prisma.staff.findUnique({ where: { username } }) matches, or a lock
  // could be dodged just by changing case.
  const row = await db.loginAttempt.findUnique({ where: { username } });

  if (!row || !row.lockedUntil || row.lockedUntil <= now()) {
    return { locked: false };
  }

  const minutesLeft = Math.max(
    1,
    Math.ceil((row.lockedUntil.getTime() - now().getTime()) / 60_000),
  );
  return { locked: true, minutesLeft };
}

export async function recordFailure(
  username: string,
  db: PrismaClient = prisma,
  now: Clock = () => new Date(),
): Promise<void> {
  const currentTime = now();
  const row = await db.loginAttempt.findUnique({ where: { username } });

  // No row, or an already-expired lock, is a clean slate — the count
  // restarts at 1 rather than continuing to climb from a stale value.
  const expiredLock = row?.lockedUntil != null && row.lockedUntil <= currentTime;
  const failedCount = !row || expiredLock ? 1 : row.failedCount + 1;
  const lockedUntil =
    failedCount >= MAX_FAILED_ATTEMPTS
      ? new Date(currentTime.getTime() + LOCK_WINDOW_MINUTES * 60_000)
      : null;

  await db.loginAttempt.upsert({
    where: { username },
    create: { username, failedCount, lockedUntil, lastFailedAt: currentTime },
    update: { failedCount, lockedUntil, lastFailedAt: currentTime },
  });
}

export async function clearFailures(
  username: string,
  db: PrismaClient = prisma,
): Promise<void> {
  // deleteMany, not delete, so a first-ever success (no row yet) does not
  // throw P2025 — clearing a lock that was never set is a no-op, not an error.
  await db.loginAttempt.deleteMany({ where: { username } });
}

export function lockedMessage(minutesLeft: number): string {
  return `Terlalu banyak percobaan. Coba lagi dalam ${minutesLeft} menit.`;
}
