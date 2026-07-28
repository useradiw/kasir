/**
 * sales-channel.test.ts — SalesChannelRepository (channel -> kas account mapping).
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { PrismaClient } from "@/generated/prisma";
import {
  SalesChannelRepository,
  ChannelAccountNotSetError,
  InvalidChannelAccountError,
} from "../lib/accounting/salesChannelRepository";
import { createTestClient, resetDb } from "./setup";

let prisma: PrismaClient;
let channels: SalesChannelRepository;

beforeAll(async () => {
  prisma = await createTestClient();
  channels = new SalesChannelRepository(prisma);
});

afterEach(async () => {
  await resetDb(prisma);
});

describe("list", () => {
  it("returns nulls for every channel on an empty table", async () => {
    const result = await channels.list();
    expect(result).toEqual({ tunai: null, elektronik: null, online: null });
  });
});

describe("set + require", () => {
  it("round-trips a mapped channel", async () => {
    await channels.set("tunai", "Assets:Cash:Laci");
    const result = await channels.list();
    expect(result.tunai).toBe("Assets:Cash:Laci");

    const required = await channels.require(["tunai"] as const);
    expect(required.tunai).toBe("Assets:Cash:Laci");
  });

  it("upserts on a second set() for the same channel", async () => {
    await channels.set("tunai", "Assets:Cash:Laci");
    await channels.set("tunai", "Assets:Cash:LaciBaru");
    const result = await channels.list();
    expect(result.tunai).toBe("Assets:Cash:LaciBaru");
  });

  it("throws ChannelAccountNotSetError for an unmapped channel", async () => {
    await channels.set("tunai", "Assets:Cash:Laci");
    await expect(channels.require(["tunai", "elektronik"] as const)).rejects.toThrow(
      ChannelAccountNotSetError,
    );
  });

  it("rejects a non-Assets: account", async () => {
    await expect(channels.set("tunai", "Income:Sales:Tunai")).rejects.toThrow(
      InvalidChannelAccountError,
    );
  });
});
