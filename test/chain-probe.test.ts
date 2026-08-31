import { describe, it, expect } from "vitest";
import { createTestClient } from "./setup";

describe("migration chain probe", () => {
  it("applies the full chain and exposes operational tables", async () => {
    const prisma = await createTestClient();
    const count = await prisma.transaction.count();
    const staff = await prisma.staff.count();
    expect(count).toBe(0);
    expect(staff).toBe(0);
  });
});
