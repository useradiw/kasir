// Dev/test accounts — one per role, all clearly marked so they can be turned
// off in a single command.
//
// EVERY account this creates is marked two ways:
//   - username starts with "dev."      (dev.owner, dev.kasir, ...)
//   - name starts with "[DEV] "        (visible in every staff list on screen)
// Nothing else in the app uses that prefix, so one WHERE clause reaches all of
// them and only them.
//
// Usage (PowerShell):
//   $env:DEV_SEED_PASSWORD="<pick one>"; node scripts/dev-accounts.mjs create
//   node scripts/dev-accounts.mjs list
//   node scripts/dev-accounts.mjs disable     # isActive = false, rows kept
//   node scripts/dev-accounts.mjs enable
//   node scripts/dev-accounts.mjs delete      # staff rows AND Supabase users
//
// The password is read from the environment and never written to a file, never
// printed, and never committed. Use one throwaway password for all five.
//
// Refuses to run unless DATABASE_URL and NEXT_PUBLIC_SUPABASE_URL name the SAME
// Supabase project. Splitting them is a real failure that already happened once
// (2026-09-02): the database was repointed to a new project while auth still
// pointed at the old one, so accounts would have been created in two places.

import { PrismaClient } from "../generated/prisma/client.js";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", override: false });

const PREFIX = "dev.";
const NAME_TAG = "[DEV] ";
const EMAIL_DOMAIN = "dev.kasir.local";

/** One account per role. DEVELOPER is a superuser and is the account Claude
 *  uses to audit screens it otherwise cannot reach. */
const ACCOUNTS = [
  { username: "dev.developer", name: "Developer (Claude)", role: "DEVELOPER" },
  { username: "dev.owner", name: "Owner Uji", role: "OWNER" },
  { username: "dev.manager", name: "Manager Uji", role: "MANAGER" },
  { username: "dev.kasir", name: "Kasir Uji", role: "CASHIER" },
  { username: "dev.staff", name: "Staff Uji", role: "STAFF" },
];

const prisma = new PrismaClient();

function projectRef(value) {
  const m = /(?:postgres\.|https:\/\/)([a-z]{20})/.exec(value ?? "");
  return m ? m[1] : null;
}

function requireMatchingProject() {
  const dbRef = projectRef(process.env.DIRECT_URL || process.env.DATABASE_URL);
  const authRef = projectRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log(`  database project: ${dbRef ?? "UNKNOWN"}`);
  console.log(`  auth project:     ${authRef ?? "UNKNOWN"}`);
  if (!dbRef || !authRef) {
    throw new Error("Could not read the project ref from DATABASE_URL or NEXT_PUBLIC_SUPABASE_URL.");
  }
  if (dbRef !== authRef) {
    throw new Error(
      `Database and auth point at DIFFERENT Supabase projects (${dbRef} vs ${authRef}). ` +
        "Fix .env / .env.local before seeding — otherwise the staff row and its login " +
        "would be created in two separate projects.",
    );
  }
  return dbRef;
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function findAuthUserByEmail(supabase, email) {
  // There is no getUserByEmail on the admin API — list and filter, the same way
  // utils/supabase/admin.ts does it.
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email === email) ?? null;
}

async function create() {
  const password = process.env.DEV_SEED_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error("Set DEV_SEED_PASSWORD to at least 8 characters before running create.");
  }
  const supabase = adminClient();

  for (const acc of ACCOUNTS) {
    const email = `${acc.username}@${EMAIL_DOMAIN}`;
    const existing = await prisma.staff.findUnique({ where: { username: acc.username } });
    if (existing) {
      console.log(`  skip   ${acc.username} — staff row already exists`);
      continue;
    }

    let authUser = await findAuthUserByEmail(supabase, email);
    if (!authUser) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // no inbox exists for dev.kasir.local
      });
      if (error) throw new Error(`createUser failed for ${email}: ${error.message}`);
      authUser = data.user;
    }

    await prisma.staff.create({
      data: {
        username: acc.username,
        name: NAME_TAG + acc.name,
        role: acc.role,
        supabaseUserId: authUser.id,
        isActive: true,
      },
    });
    console.log(`  create ${acc.username}  ${acc.role}`);
  }
}

async function list() {
  const rows = await prisma.staff.findMany({
    where: { username: { startsWith: PREFIX } },
    select: { username: true, name: true, role: true, isActive: true, supabaseUserId: true },
    orderBy: { username: "asc" },
  });
  if (rows.length === 0) return console.log("  none");
  for (const r of rows) {
    console.log(
      `  ${r.isActive ? "on " : "off"}  ${r.username.padEnd(15)} ${r.role.padEnd(10)} ` +
        `${r.supabaseUserId ? "linked" : "NOT LINKED"}  ${r.name}`,
    );
  }
}

async function setActive(isActive) {
  const res = await prisma.staff.updateMany({
    where: { username: { startsWith: PREFIX } },
    data: { isActive },
  });
  console.log(`  ${isActive ? "enabled" : "disabled"} ${res.count} account(s)`);
}

async function destroy() {
  const supabase = adminClient();
  const rows = await prisma.staff.findMany({ where: { username: { startsWith: PREFIX } } });
  for (const r of rows) {
    if (r.supabaseUserId) {
      const { error } = await supabase.auth.admin.deleteUser(r.supabaseUserId);
      // Report and continue: a missing auth user must not strand the staff row.
      if (error) console.log(`  warn   auth user for ${r.username}: ${error.message}`);
    }
    await prisma.staff.delete({ where: { id: r.id } });
    console.log(`  delete ${r.username}`);
  }
  if (rows.length === 0) console.log("  none");
}

const COMMANDS = { create, list, disable: () => setActive(false), enable: () => setActive(true), delete: destroy };

const cmd = process.argv[2];
if (!Object.hasOwn(COMMANDS, cmd)) {
  console.error(`Usage: node scripts/dev-accounts.mjs <${Object.keys(COMMANDS).join("|")}>`);
  process.exit(1);
}

console.log(`dev-accounts ${cmd}`);
try {
  requireMatchingProject();
  await COMMANDS[cmd]();
} catch (e) {
  console.error(`\nFAILED: ${e.message}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
