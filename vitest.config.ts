import { defineConfig } from "vitest/config";
import path from "node:path";

// Warung Books accounting tests run against pglite (in-process WASM Postgres)
// via pglite-prisma-adapter — the REAL AccountingRepository code runs unchanged,
// same Prisma client methods as production Supabase. No DB server, no network.
export default defineConfig({
  resolve: {
    // Mirrors tsconfig.json's "@/*" -> "./*" path alias (kasir has no src/ dir),
    // which Next.js resolves via webpack but vitest/vite need spelled out explicitly.
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    globals: false,
    environment: "node",
    // pglite uses WASM; a single fork keeps it deterministic (single connection).
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    testTimeout: 60_000,
    include: ["test/**/*.test.ts"],
  },
});
