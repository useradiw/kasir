// E2E smoke for editPurchase + WMA replay on the dev DB.
//
// Reproduces the real arang failure mode: a purchase recorded with packLabel=null
// (qty interpreted as base units) when it should have used a "bks" pack with
// baseQty=3300. Fixing the row should produce currentStock=6600 g and
// averageUnitCost≈3.03 Rp/g, with total Rp on hand unchanged.
//
// Run: $env:DATABASE_URL=<dev>; node scripts/smoke-purchase-edit.mjs
import { PrismaClient } from "../generated/prisma/client.js";
const prisma = new PrismaClient();
const TAG = "__smoke_edit_purchase__";

const APPROX = (a, b, eps = 0.01) => Math.abs(a - b) <= eps;

let pass = 0, fail = 0;
function check(label, ok, detail = "") {
  if (ok) { console.log(`  ✓ ${label}${detail ? ` (${detail})` : ""}`); pass++; }
  else    { console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`); fail++; }
}

async function cleanup() {
  const ings = await prisma.ingredient.findMany({ where: { name: { startsWith: TAG } }, select: { id: true } });
  const ingIds = ings.map((i) => i.id);
  if (ingIds.length === 0) return;
  await prisma.ingredientLog.deleteMany({ where: { ingredientId: { in: ingIds } } });
  await prisma.ingredientPurchase.deleteMany({ where: { ingredientId: { in: ingIds } } });
  await prisma.ingredientPack.deleteMany({ where: { ingredientId: { in: ingIds } } });
  const expenseItemIds = (
    await prisma.expenseItem.findMany({ where: { ingredientId: { in: ingIds } }, select: { id: true, expenseId: true } })
  );
  await prisma.expenseItem.deleteMany({ where: { ingredientId: { in: ingIds } } });
  const expenseIds = [...new Set(expenseItemIds.map((i) => i.expenseId))];
  if (expenseIds.length > 0) await prisma.expense.deleteMany({ where: { id: { in: expenseIds } } });
  await prisma.ingredient.deleteMany({ where: { id: { in: ingIds } } });
}

// Inline mirror of editPurchase + replay (server runtime not available).
async function runEdit(purchaseId, { packLabel, packQty, totalCost }) {
  await prisma.$transaction(async (tx) => {
    const purchase = await tx.ingredientPurchase.findUniqueOrThrow({
      where: { id: purchaseId },
      select: { id: true, ingredientId: true, source: true, expenseItemId: true },
    });
    let packBaseQty = 1;
    if (packLabel) {
      const pack = await tx.ingredientPack.findUnique({
        where: { ingredientId_label: { ingredientId: purchase.ingredientId, label: packLabel } },
        select: { baseQty: true },
      });
      if (!pack) throw new Error(`Pack ${packLabel} not found`);
      packBaseQty = pack.baseQty;
    }
    const baseQty = packQty * packBaseQty;
    const unitCost = baseQty > 0 ? totalCost / baseQty : 0;
    await tx.ingredientPurchase.update({
      where: { id: purchaseId },
      data: { packLabel, packQty, baseQty, totalCost, unitCost },
    });
    if (purchase.expenseItemId) {
      await tx.expenseItem.update({
        where: { id: purchase.expenseItemId },
        data: { unit: packLabel, amount: packQty, cost: packQty > 0 ? Math.round(totalCost / packQty) : 0 },
      });
      await tx.ingredientLog.updateMany({
        where: { ingredientId: purchase.ingredientId, type: "PURCHASE", referenceId: purchase.expenseItemId },
        data: { quantity: baseQty, unitCost },
      });
    }

    // Replay
    const [purchases, logs] = await Promise.all([
      tx.ingredientPurchase.findMany({
        where: { ingredientId: purchase.ingredientId },
        orderBy: [{ purchasedAt: "asc" }, { id: "asc" }],
      }),
      tx.ingredientLog.findMany({
        where: { ingredientId: purchase.ingredientId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    ]);
    const pairedLogIds = new Set();
    for (const lg of logs) {
      if (lg.type === "PURCHASE" && lg.referenceId) {
        const match = purchases.find((p) => p.source === "EXPENSE" && p.expenseItemId === lg.referenceId);
        if (match) pairedLogIds.add(lg.id);
      } else if (lg.type === "ASSEMBLY" && lg.quantity > 0) {
        const match = purchases.find(
          (p) => p.source === "ASSEMBLY" && Math.abs(p.purchasedAt.getTime() - lg.createdAt.getTime()) < 1000,
        );
        if (match) pairedLogIds.add(lg.id);
      }
    }
    const events = [
      ...purchases.map((p, i) => ({ kind: "purchase", t: p.purchasedAt.getTime(), idx: i })),
      ...logs.map((l, i) => ({ lg: l, idx: i })).filter((x) => !pairedLogIds.has(x.lg.id)).map((x) => ({ kind: "log", t: x.lg.createdAt.getTime(), idx: x.idx })),
    ];
    events.sort((a, b) => a.t - b.t || (a.kind === "purchase" ? -1 : 1));
    let stock = 0, avg = 0, lastUnitCost = null;
    const updates = [];
    for (const ev of events) {
      if (ev.kind === "purchase") {
        const p = purchases[ev.idx];
        if (p.source === "ADJUSTMENT") { avg = p.unitCost; lastUnitCost = p.unitCost; }
        else {
          const ns = stock + p.baseQty;
          avg = ns > 0 ? (avg * stock + p.totalCost) / ns : p.unitCost;
          stock = ns;
          lastUnitCost = p.unitCost;
        }
        updates.push({ id: p.id, avgUnitCostAfter: avg, stockAfter: stock });
      } else {
        stock += logs[ev.idx].quantity;
      }
    }
    for (const u of updates) {
      await tx.ingredientPurchase.update({ where: { id: u.id }, data: { avgUnitCostAfter: u.avgUnitCostAfter, stockAfter: u.stockAfter } });
    }
    await tx.ingredient.update({
      where: { id: purchase.ingredientId },
      data: { currentStock: stock, averageUnitCost: avg, lastUnitCost },
    });
  });
}

async function main() {
  console.log("Cleanup prior runs...");
  await cleanup();

  console.log("\nSetup: arang WEIGHT with pack bks (baseQty=3300), one bad purchase (packLabel=null)");

  const ing = await prisma.ingredient.create({
    data: { name: `${TAG} Arang`, category: "BAHAN", unitClass: "WEIGHT", baseUnit: "g", currentStock: 2, averageUnitCost: 10000, lastUnitCost: 10000 },
  });
  await prisma.ingredientPack.create({
    data: { ingredientId: ing.id, label: "bks", baseQty: 3300, isDefault: false },
  });

  // Need a Staff row to set as expense.staffId
  const anyStaff = await prisma.staff.findFirst();
  if (!anyStaff) { console.error("  no Staff row exists — cannot create Expense for smoke. Aborting."); process.exit(1); }

  // Create expense + expense item + purchase + log (mirrors what addExpenseForStaff would write,
  // but with the bad packLabel=null state we want to fix).
  const expense = await prisma.expense.create({
    data: {
      description: `${TAG} bad purchase`, staffId: anyStaff.id, supplierId: null,
      deductFromCash: true, countToKasPakHar: false,
      items: { create: [{ description: "Arang", amount: 2, cost: 10000, unit: null, ingredientId: ing.id }] },
    },
    include: { items: true },
  });
  const expenseItem = expense.items[0];

  const purchase = await prisma.ingredientPurchase.create({
    data: {
      ingredientId: ing.id, source: "EXPENSE", supplierId: null, expenseItemId: expenseItem.id,
      packLabel: null, packQty: 2, baseQty: 2, totalCost: 20000, unitCost: 10000,
      avgUnitCostAfter: 10000, stockAfter: 2,
    },
  });
  await prisma.ingredientLog.create({
    data: { ingredientId: ing.id, type: "PURCHASE", quantity: 2, unitCost: 10000, referenceId: expenseItem.id, note: "smoke pre-edit" },
  });

  const pre = await prisma.ingredient.findUniqueOrThrow({ where: { id: ing.id } });
  const preRpOnHand = pre.currentStock * pre.averageUnitCost;
  console.log(`  pre: stock=${pre.currentStock} g, avg=${pre.averageUnitCost} Rp/g, RpOnHand=${preRpOnHand}`);

  console.log("\nEdit: packLabel=bks, packQty=2, totalCost=20000");
  await runEdit(purchase.id, { packLabel: "bks", packQty: 2, totalCost: 20000 });

  const post = await prisma.ingredient.findUniqueOrThrow({ where: { id: ing.id } });
  const postPurchase = await prisma.ingredientPurchase.findUniqueOrThrow({ where: { id: purchase.id } });
  const postLog = await prisma.ingredientLog.findFirstOrThrow({
    where: { ingredientId: ing.id, type: "PURCHASE", referenceId: expenseItem.id },
  });
  const postExp = await prisma.expenseItem.findUniqueOrThrow({ where: { id: expenseItem.id } });
  const postRpOnHand = post.currentStock * post.averageUnitCost;

  console.log(`  post: stock=${post.currentStock} g, avg=${post.averageUnitCost.toFixed(4)} Rp/g, RpOnHand=${postRpOnHand.toFixed(2)}`);

  console.log("\nInvariants:");
  check("currentStock = 6600 g (2 × 3300)", APPROX(post.currentStock, 6600));
  check("averageUnitCost ≈ 3.0303 Rp/g (20000/6600)", APPROX(post.averageUnitCost, 20000 / 6600, 0.01));
  check("Rp on hand = totalCost = 20000 (avg × stock)", APPROX(postRpOnHand, 20000, 0.5), `was ${preRpOnHand}, now ${postRpOnHand.toFixed(2)}`);
  check("purchase.packLabel = bks", postPurchase.packLabel === "bks");
  check("purchase.baseQty = 6600", APPROX(postPurchase.baseQty, 6600));
  check("purchase.unitCost ≈ 3.0303", APPROX(postPurchase.unitCost, 20000 / 6600, 0.01));
  check("purchase.totalCost = 20000 (unchanged)", postPurchase.totalCost === 20000);
  check("purchase.avgUnitCostAfter and stockAfter set by replay", APPROX(postPurchase.stockAfter, 6600) && APPROX(postPurchase.avgUnitCostAfter, 20000 / 6600, 0.01));
  check("matching PURCHASE log quantity rescaled to 6600", APPROX(postLog.quantity, 6600));
  check("matching PURCHASE log unitCost ≈ 3.0303", APPROX(postLog.unitCost, 20000 / 6600, 0.01));
  check("ExpenseItem.unit synced to bks", postExp.unit === "bks");
  check("ExpenseItem.amount = 2", postExp.amount === 2);
  check("ExpenseItem.cost = 10000 (= 20000/2)", postExp.cost === 10000);

  const auditLogs = await prisma.ingredientLog.findMany({
    where: { ingredientId: ing.id, type: "ADJUSTMENT", quantity: 0 },
  });
  // Note: this inline mirror doesn't write the audit row (only the real action does), so we
  // don't assert its presence here — that's a code review check.
  console.log(`  (audit row count: ${auditLogs.length} — not asserted; written only by the real action)`);

  console.log("\nCleanup:");
  await cleanup();
  console.log("  removed all smoke rows");

  console.log(`\n${pass} passed, ${fail} failed.`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error("FAIL:", e); process.exit(1); }).finally(() => prisma.$disconnect());
