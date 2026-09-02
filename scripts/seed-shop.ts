/**
 * seed-shop.ts — demo shop seed for the blank Supabase project.
 *
 * Seeds a usable "Sate Kambing Sido Mampir" demo shop so screens have real
 * data to render: chart of accounts, kas accounts, sales-channel mapping,
 * expense categories, the current accounting month, shop settings, and a menu
 * (categories, items, variants, one package).
 *
 * REUSES existing seed functions / repositories — does not hand-write rows
 * they own:
 *   - seedChartOfAccounts(prisma)              lib/accounting/chart-of-accounts.ts
 *   - ExpenseRepository.ensureDefaultCategories lib/accounting/expenseRepository.ts
 *   - CashAccountRepository                     lib/accounting/cashAccountRepository.ts
 *   - SalesChannelRepository                    lib/accounting/salesChannelRepository.ts
 *   - MonthRepository                           lib/accounting/monthRepository.ts
 *   - getSettings()                             lib/settings.ts (SETTING_DEFAULTS
 *     is already a sate-warung profile — "Sate Kambing Sido Mampir" — so reusing
 *     it IS seeding sensible values, not inventing new ones)
 *
 * IDEMPOTENT — safe to run twice. Skips anything that already exists and
 * prints one line per created/skipped thing.
 *
 * Deliberately does NOT create any Transaction, TableSession, CashRegister or
 * JournalEntry — money rows must come from the real UI, never a seed.
 *
 * Usage: npx tsx scripts/seed-shop.ts
 */

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", override: false });

import { PrismaClient } from "../generated/prisma";
import { seedChartOfAccounts } from "../lib/accounting/chart-of-accounts";
import { ExpenseRepository } from "../lib/accounting/expenseRepository";
import { CashAccountRepository } from "../lib/accounting/cashAccountRepository";
import { SalesChannelRepository, type SalesChannel } from "../lib/accounting/salesChannelRepository";
import { MonthRepository } from "../lib/accounting/monthRepository";
import { getSettings } from "../lib/settings";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// 2. Kas accounts — deliberately NOT part of the structural chart-of-accounts
//    seed. The owner defines these; here we stand in for that first-run step.
// ---------------------------------------------------------------------------

const KAS_ACCOUNTS = ["Kas Laci", "Kas Pak Har", "Bank BCA"] as const;

// ---------------------------------------------------------------------------
// 3. Sales-channel -> kas account mapping
// ---------------------------------------------------------------------------

const CHANNEL_TO_KAS: Record<SalesChannel, (typeof KAS_ACCOUNTS)[number]> = {
  tunai: "Kas Laci",
  elektronik: "Kas Laci",
  online: "Bank BCA",
};

// ---------------------------------------------------------------------------
// 7. Menu — 4 categories, ~12 items, 2+ with variants, 1 package
// ---------------------------------------------------------------------------

interface VariantSeed {
  label: string;
  priceModifier: number;
}

interface MenuItemSeed {
  name: string;
  price: number;
  variants?: VariantSeed[];
}

interface CategorySeed {
  name: string;
  sortOrder: number;
  items: MenuItemSeed[];
}

const MENU: CategorySeed[] = [
  {
    name: "Sate",
    sortOrder: 0,
    items: [
      {
        name: "Sate Kambing",
        price: 35000,
        variants: [
          { label: "10 tusuk", priceModifier: 0 },
          { label: "15 tusuk", priceModifier: 15000 },
        ],
      },
      {
        name: "Sate Ayam",
        price: 25000,
        variants: [
          { label: "10 tusuk", priceModifier: 0 },
          { label: "15 tusuk", priceModifier: 10000 },
        ],
      },
      { name: "Sate Buntel", price: 40000 },
    ],
  },
  {
    name: "Gulai & Tongseng",
    sortOrder: 1,
    items: [
      { name: "Gulai Kambing", price: 30000 },
      { name: "Tongseng Kambing", price: 32000 },
      { name: "Tengkleng", price: 35000 },
    ],
  },
  {
    name: "Nasi & Pelengkap",
    sortOrder: 2,
    items: [
      { name: "Nasi Putih", price: 6000 },
      { name: "Lontong", price: 7000 },
      { name: "Kerupuk", price: 3000 },
      { name: "Acar", price: 3000 },
    ],
  },
  {
    name: "Minuman",
    sortOrder: 3,
    items: [
      { name: "Es Teh Manis", price: 6000 },
      { name: "Teh Hangat", price: 5000 },
      { name: "Es Jeruk", price: 8000 },
    ],
  },
];

const PACKAGE_SEED = {
  name: "Paket Sate Kambing + Nasi",
  bundlePrice: 39000,
  // [categoryName, itemName] pairs — resolved against the menu above.
  items: [
    ["Sate", "Sate Kambing"],
    ["Nasi & Pelengkap", "Nasi Putih"],
  ] as [string, string][],
};

// ---------------------------------------------------------------------------

async function seedKasAccounts(): Promise<Map<string, string>> {
  console.log("\n== Kas accounts ==");
  const repo = new CashAccountRepository(prisma);
  const existing = await repo.list(true);
  const byLabel = new Map(existing.map((a) => [a.label, a.name]));

  for (const label of KAS_ACCOUNTS) {
    if (byLabel.has(label)) {
      console.log(`  skip   ${label} — already exists`);
      continue;
    }
    const row = await repo.create(label);
    byLabel.set(label, row.name);
    console.log(`  create ${label}  (${row.name})`);
  }
  return byLabel;
}

async function seedSalesChannels(kasByLabel: Map<string, string>) {
  console.log("\n== Sales-channel mapping ==");
  const repo = new SalesChannelRepository(prisma);
  const current = await repo.list();

  for (const [channel, kasLabel] of Object.entries(CHANNEL_TO_KAS) as [SalesChannel, string][]) {
    const account = kasByLabel.get(kasLabel);
    if (!account) throw new Error(`Kas account "${kasLabel}" was not seeded — cannot map ${channel}.`);
    if (current[channel] === account) {
      console.log(`  skip   ${channel} -> ${account} — already mapped`);
      continue;
    }
    await repo.set(channel, account);
    console.log(`  set    ${channel} -> ${account}`);
  }
}

async function seedMonth() {
  console.log("\n== Accounting month ==");
  const repo = new MonthRepository(prisma);
  const month = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const existing = await repo.list();
  if (existing.some((m) => m.month === month)) {
    console.log(`  skip   ${month} — already exists`);
    return;
  }
  await repo.create(month);
  console.log(`  create ${month}`);
}

async function seedSettings() {
  console.log("\n== Shop settings ==");
  // getSettings() upserts any missing key from SETTING_DEFAULTS and returns the
  // full map — SETTING_DEFAULTS is already a sate-warung profile ("Sate Kambing
  // Sido Mampir"), so this both seeds and reports without hand-writing values.
  const before = await prisma.setting.findMany({ select: { key: true } });
  const beforeKeys = new Set(before.map((r) => r.key));
  const settings = await getSettings();
  for (const key of Object.keys(settings)) {
    console.log(`  ${beforeKeys.has(key) ? "skip  " : "create"} ${key} = "${settings[key]}"`);
  }
}

async function seedMenu() {
  console.log("\n== Menu ==");
  const categoryIdByName = new Map<string, string>();
  const menuItemIdByKey = new Map<string, string>(); // "Category::Item" -> id
  const variantIdByKey = new Map<string, string>(); // "Category::Item::Label" -> id

  for (const cat of MENU) {
    let category = await prisma.category.findFirst({ where: { name: cat.name } });
    if (category) {
      console.log(`  skip   kategori ${cat.name}`);
    } else {
      category = await prisma.category.create({ data: { name: cat.name, sortOrder: cat.sortOrder } });
      console.log(`  create kategori ${cat.name}`);
    }
    categoryIdByName.set(cat.name, category.id);

    for (const item of cat.items) {
      const key = `${cat.name}::${item.name}`;
      let menuItem = await prisma.menuItem.findFirst({
        where: { name: item.name, categoryId: category.id },
      });
      if (menuItem) {
        console.log(`  skip   item ${item.name}`);
      } else {
        menuItem = await prisma.menuItem.create({
          data: { name: item.name, categoryId: category.id, price: item.price },
        });
        console.log(`  create item ${item.name} (Rp${item.price})`);
      }
      menuItemIdByKey.set(key, menuItem.id);

      for (const variant of item.variants ?? []) {
        const vkey = `${key}::${variant.label}`;
        let variantRow = await prisma.menuVariant.findFirst({
          where: { menuItemId: menuItem.id, label: variant.label },
        });
        if (variantRow) {
          console.log(`    skip   varian ${item.name} / ${variant.label}`);
        } else {
          variantRow = await prisma.menuVariant.create({
            data: {
              menuItemId: menuItem.id,
              label: variant.label,
              priceModifier: variant.priceModifier,
            },
          });
          console.log(`    create varian ${item.name} / ${variant.label} (+Rp${variant.priceModifier})`);
        }
        variantIdByKey.set(vkey, variantRow.id);
      }
    }
  }

  // Package
  let pkg = await prisma.package.findFirst({ where: { name: PACKAGE_SEED.name } });
  if (pkg) {
    console.log(`  skip   paket ${PACKAGE_SEED.name}`);
  } else {
    pkg = await prisma.package.create({
      data: { name: PACKAGE_SEED.name, bundlePrice: PACKAGE_SEED.bundlePrice },
    });
    console.log(`  create paket ${PACKAGE_SEED.name} (Rp${PACKAGE_SEED.bundlePrice})`);
  }

  for (const [catName, itemName] of PACKAGE_SEED.items) {
    const menuItemId = menuItemIdByKey.get(`${catName}::${itemName}`);
    if (!menuItemId) throw new Error(`Package item "${itemName}" was not seeded in "${catName}".`);
    const existingLink = await prisma.packageItem.findFirst({
      where: { packageId: pkg.id, menuItemId, variantId: null },
    });
    if (existingLink) {
      console.log(`    skip   paket item ${itemName}`);
      continue;
    }
    await prisma.packageItem.create({
      data: { packageId: pkg.id, menuItemId, nameSnapshot: itemName },
    });
    console.log(`    create paket item ${itemName}`);
  }
}

async function main() {
  console.log("seed-shop — demo shop for the blank database\n");

  console.log("== Chart of accounts ==");
  await seedChartOfAccounts(prisma);
  console.log("  ok (upserted — see lib/accounting/chart-of-accounts.ts for the fixed list)");

  const kasByLabel = await seedKasAccounts();
  await seedSalesChannels(kasByLabel);

  console.log("\n== Expense categories ==");
  const expenseRepo = new ExpenseRepository(prisma);
  const beforeCount = await prisma.expenseCategory.count();
  await expenseRepo.ensureDefaultCategories();
  const afterCount = await prisma.expenseCategory.count();
  console.log(
    beforeCount > 0
      ? `  skip   ${beforeCount} kategori pengeluaran already exist`
      : `  create ${afterCount} default kategori pengeluaran`,
  );

  await seedMonth();
  await seedSettings();
  await seedMenu();

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error("\nFAILED:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
