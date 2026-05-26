import { spawn } from "node:child_process";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.claude.local");

const result = config({ path: envPath, override: true });
if (result.error) {
  console.error(`[dev-claude] failed to load ${envPath}:`, result.error.message);
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
