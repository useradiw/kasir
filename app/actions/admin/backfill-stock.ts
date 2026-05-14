"use server";

import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { runAction } from "@/lib/action-error";
import { revalidateIngredients } from "@/lib/revalidate";

/**
 * One-time backfill: populate IngredientLog and currentStock from historical
 * ExpenseItem records that have a templateId.
 *
 * Safety notes:
 * - Only processes ExpenseItems that have a templateId (FK link) — skips custom names.
 * - Skips templates that already have any IngredientLog entries (idempotent).
 * - Does NOT attempt name-matching; only exact templateId FK links are used.
 * - Run once after the migration. Re-running is safe (skips already-backfilled templates).
 */
export async function backfillIngredientStock(): Promise<{
  processed: number;
  skipped: number;
  templatesUpdated: number;
}> {
  return runAction(async () => {
    await requireOwner();

    // Get all active templates
    const templates = await prisma.expenseTemplate.findMany({
      select: { id: true, name: true },
    });

    let processed = 0;
    let skipped = 0;
    let templatesUpdated = 0;

    for (const template of templates) {
      // Check if this template already has any logs (skip if already backfilled)
      const existingLog = await prisma.ingredientLog.findFirst({
        where: { templateId: template.id },
        select: { id: true },
      });
      if (existingLog) {
        skipped++;
        continue;
      }

      // Get all purchase history for this template (ordered oldest → newest)
      const expenseItems = await prisma.expenseItem.findMany({
        where: { templateId: template.id },
        include: { expense: { select: { recordedAt: true } } },
        orderBy: { expense: { recordedAt: "asc" } },
      });

      if (expenseItems.length === 0) {
        skipped++;
        continue;
      }

      // Create PURCHASE logs and compute running stock total
      let totalStock = 0;
      await prisma.$transaction(async (tx) => {
        for (const item of expenseItems) {
          await tx.ingredientLog.create({
            data: {
              templateId: template.id,
              type: "PURCHASE",
              quantity: item.amount,
              unitCost: item.cost,
              referenceId: item.id,
              note: "Backfill from historical expense",
              createdAt: item.expense.recordedAt,
            },
          });
          totalStock += item.amount;
        }

        // Set currentStock to the sum of all historical purchases
        // (does not deduct past sales — those will be deducted going forward)
        await tx.expenseTemplate.update({
          where: { id: template.id },
          data: { currentStock: totalStock },
        });
      });

      processed++;
      templatesUpdated++;
    }

    revalidateIngredients();
    return { processed, skipped, templatesUpdated };
  });
}
