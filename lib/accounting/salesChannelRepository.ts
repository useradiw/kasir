/**
 * salesChannelRepository.ts — sales-channel -> kas account mapping (Slice 3a).
 *
 * SalesChannelAccount is a tiny registry table: each of the three sale tenders
 * ("tunai" | "elektronik" | "online") maps to a Beancount cash-account name.
 * salesPostingRepository / settlementPostingRepository read this mapping (via
 * `require()`) to know which Assets:Cash:* account a channel's cash lands in.
 *
 * This repository does NOT touch the journal — it is a pure registry CRUD,
 * same spirit as cashAccountRepository.
 */

import { PrismaClient } from "@/generated/prisma";
import { DomainError } from "../errors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const SALES_CHANNELS = ["tunai", "elektronik", "online"] as const;
export type SalesChannel = (typeof SALES_CHANNELS)[number];

const CHANNEL_LABELS: Readonly<Record<SalesChannel, string>> = {
  tunai: "Tunai",
  elektronik: "Elektronik (QRIS/transfer)",
  online: "Online",
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ChannelAccountNotSetError extends DomainError {
  constructor(channel: SalesChannel) {
    super(
      `Akun kas untuk penjualan "${CHANNEL_LABELS[channel]}" belum diatur. Buka Keuangan → Akun Penjualan untuk mengaturnya.`,
    );
    this.name = "ChannelAccountNotSetError";
  }
}

export class InvalidChannelAccountError extends DomainError {
  constructor(account: string) {
    super(`Akun "${account}" tidak valid — akun penjualan harus akun kas (diawali "Assets:").`);
    this.name = "InvalidChannelAccountError";
  }
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class SalesChannelRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Every known channel -> mapped account, or null when unmapped. */
  async list(): Promise<Record<SalesChannel, string | null>> {
    const rows = await this.prisma.salesChannelAccount.findMany();
    const byChannel = new Map(rows.map((r) => [r.channel, r.account]));
    const result = {} as Record<SalesChannel, string | null>;
    for (const channel of SALES_CHANNELS) {
      result[channel] = byChannel.get(channel) ?? null;
    }
    return result;
  }

  /** Map (or remap) a channel to a kas account. Upserts by unique `channel`. */
  async set(channel: SalesChannel, account: string): Promise<void> {
    if (!account.startsWith("Assets:")) {
      throw new InvalidChannelAccountError(account);
    }
    await this.prisma.salesChannelAccount.upsert({
      where: { channel },
      update: { account },
      create: { channel, account },
    });
  }

  /**
   * Resolve the mapped accounts for the given channels, throwing
   * ChannelAccountNotSetError for the first unmapped one found.
   */
  async require<C extends SalesChannel>(
    channels: readonly C[],
  ): Promise<Record<C, string>> {
    const all = await this.list();
    const result = {} as Record<C, string>;
    for (const channel of channels) {
      const account = all[channel];
      if (!account) throw new ChannelAccountNotSetError(channel);
      result[channel] = account;
    }
    return result;
  }
}
