"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { revalidateSettings, revalidateIngredients } from "@/lib/revalidate";
import { runAction } from "@/lib/action-error";
import { getSettings } from "@/lib/settings";
import {
  DEFAULT_BASE_UNIT,
  SETTING_KEY,
  resolveBaseUnit,
  type UnitClassName,
} from "@/lib/unit-class";

const schema = z.object({
  unit_base_weight: z.string().min(1, "Satuan dasar Berat tidak boleh kosong"),
  unit_base_volume: z.string().min(1, "Satuan dasar Volume tidak boleh kosong"),
  unit_base_count:  z.string().min(1, "Satuan dasar Jumlah tidak boleh kosong"),
});

/**
 * Returns the current resolved base unit per class + a count of ingredients
 * with stock/usage history per class. The history count is what gates whether
 * the override can be safely changed.
 */
export async function getUnitSettingsView() {
  await requireOwner();
  const settings = await getSettings();

  const rows = await prisma.ingredient.groupBy({
    by: ["unitClass"],
    _count: { _all: true },
  });
  const countByClass: Record<UnitClassName, number> = { WEIGHT: 0, VOLUME: 0, COUNT: 0 };
  for (const r of rows) countByClass[r.unitClass as UnitClassName] = r._count._all;

  const classes = ["WEIGHT", "VOLUME", "COUNT"] as UnitClassName[];
  const inUseWhere = (cls: UnitClassName) => ({
    unitClass: cls,
    OR: [
      { currentStock: { gt: 0 } },
      { purchases:    { some: {} } },
      { ingredientLogs: { some: {} } },
      { recipeIngredients: { some: {} } },
      { componentOf:  { some: {} } },
    ],
  });
  const [wUsed, vUsed, cUsed] = await Promise.all(
    classes.map((cls) => prisma.ingredient.count({ where: inUseWhere(cls) })),
  );
  const inUseByClass: Record<UnitClassName, boolean> = {
    WEIGHT: wUsed > 0,
    VOLUME: vUsed > 0,
    COUNT:  cUsed > 0,
  };

  return {
    current: {
      WEIGHT: resolveBaseUnit("WEIGHT", settings),
      VOLUME: resolveBaseUnit("VOLUME", settings),
      COUNT:  resolveBaseUnit("COUNT", settings),
    },
    defaults: DEFAULT_BASE_UNIT,
    countByClass,
    inUseByClass,
  };
}

export async function updateUnitSettings(input: {
  unit_base_weight: string;
  unit_base_volume: string;
  unit_base_count:  string;
}) {
  return runAction(async () => {
    await requireOwner();
    const parsed = schema.parse({
      unit_base_weight: input.unit_base_weight.trim(),
      unit_base_volume: input.unit_base_volume.trim(),
      unit_base_count:  input.unit_base_count.trim(),
    });

    const settings = await getSettings();
    const current = {
      WEIGHT: resolveBaseUnit("WEIGHT", settings),
      VOLUME: resolveBaseUnit("VOLUME", settings),
      COUNT:  resolveBaseUnit("COUNT", settings),
    };
    const wanted = {
      WEIGHT: parsed.unit_base_weight,
      VOLUME: parsed.unit_base_volume,
      COUNT:  parsed.unit_base_count,
    };

    const updates: { key: string; value: string }[] = [];
    for (const cls of ["WEIGHT", "VOLUME", "COUNT"] as UnitClassName[]) {
      if (current[cls] !== wanted[cls]) {
        // Block if any ingredient in this class already has stock/usage —
        // changing the base unit silently would invalidate historical Rp/qty.
        const inUse = await prisma.ingredient.count({
          where: {
            unitClass: cls,
            OR: [
              { currentStock: { gt: 0 } },
              { purchases:    { some: {} } },
              { ingredientLogs: { some: {} } },
              { recipeIngredients: { some: {} } },
              { componentOf:  { some: {} } },
            ],
          },
        });
        if (inUse > 0) {
          throw new Error(
            `Tidak bisa mengganti satuan dasar ${cls} dari "${current[cls]}" ke "${wanted[cls]}": ` +
            `sudah ada ${inUse} bahan kelas ${cls} dengan stok/riwayat. ` +
            `Opname nol semua bahan kelas itu dulu, atau biarkan satuan saat ini.`,
          );
        }
        updates.push({ key: SETTING_KEY[cls], value: wanted[cls] });
      }
    }

    if (updates.length === 0) return { updated: 0 };

    await prisma.$transaction(
      updates.map(({ key, value }) =>
        prisma.setting.upsert({
          where:  { key },
          update: { value },
          create: { key, value },
        }),
      ),
    );

    revalidateSettings();
    revalidateIngredients();
    return { updated: updates.length };
  });
}
