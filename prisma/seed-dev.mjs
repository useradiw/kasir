/**
 * Dev-only seed — creates the DEVELOPER staff account used by Claude.
 *
 * Run against the DEV database only. DATABASE_URL must be provided on the
 * command line (the dev DB); Supabase Auth vars are read from .env.local.
 *
 *   DATABASE_URL='<dev db url>' node prisma/seed-dev.mjs
 *
 * The DEVELOPER role is a superuser for every action EXCEPT hard deletes.
 */
import { config } from "dotenv";
import { createRequire } from "node:module";

// Load Supabase Auth vars from .env.local. dotenv does NOT override an
// already-set DATABASE_URL, so the dev URL passed on the CLI wins.
config({ path: ".env.local" });

const require = createRequire(import.meta.url);
const { PrismaClient } = require("../generated/prisma");
const { createClient } = require("@supabase/supabase-js");

const DEV_EMAIL = "adminsidomampir@gmail.com";

async function findSupabaseUserId(supabase, email) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find(
      (u) => u.email && u.email.toLowerCase() === email.toLowerCase(),
    );
    if (match) return match.id;
    if (data.users.length < 1000) return null;
  }
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`🔎 Resolving Supabase user for ${DEV_EMAIL} ...`);
  const supabaseUserId = await findSupabaseUserId(supabase, DEV_EMAIL);
  if (!supabaseUserId) {
    throw new Error(`No Supabase Auth user found with email ${DEV_EMAIL}`);
  }
  console.log(`   supabaseUserId = ${supabaseUserId}`);

  const prisma = new PrismaClient();
  try {
    const dev = await prisma.staff.upsert({
      where: { supabaseUserId },
      update: { username: "Kasir", name: "Developer (Claude)", role: "DEVELOPER", isActive: true },
      create: {
        username: "Kasir",
        name: "Developer (Claude)",
        role: "DEVELOPER",
        isActive: true,
        supabaseUserId,
      },
    });
    console.log(`✅ DEVELOPER staff ready: ${dev.name} (id ${dev.id}, username "${dev.username}")`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("❌ seed-dev failed:", e);
  process.exit(1);
});
