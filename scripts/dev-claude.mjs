import { spawn } from "node:child_process";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.claude.local");

// `.env.claude.local` was kasir's dev DB until 2026-07-27, when that Supabase
// project turned out to belong to ANOTHER PROJECT. Running kasir against it
// writes kasir rows into someone else's database, so it is hard-blocked here.
// There is no kasir dev DB. See HANDOFF.md.
const FOREIGN_PROJECT_REF = "ytuyawfpcdamtelwtrdw";

const result = config({ path: envPath, override: true });
if (result.error) {
  console.error(`[dev-claude] failed to load ${envPath}:`, result.error.message);
  process.exit(1);
}

if ((process.env.DATABASE_URL ?? "").includes(FOREIGN_PROJECT_REF)) {
  console.error(
    `\n[dev-claude] REFUSING TO START.\n` +
      `  ${envPath} points at Supabase project ${FOREIGN_PROJECT_REF},\n` +
      `  which belongs to a DIFFERENT PROJECT. Writing kasir data there would\n` +
      `  corrupt it. kasir has no dev database.\n\n` +
      `  Use \`npm run dev\` (production DB, read carefully) or point\n` +
      `  .env.claude.local at a real kasir database first.\n`,
  );
  process.exit(1);
}

const host = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").host;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
})();
console.log(`[dev-claude] loaded ${envPath}`);
console.log(`[dev-claude] DATABASE_URL host: ${host}`);

const child = spawn("npx", ["next", "dev"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
  cwd: root,
});
child.on("exit", (code) => process.exit(code ?? 0));
