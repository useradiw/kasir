/**
 * UnitClass helpers — single source of truth for per-class base units.
 *
 * Every Ingredient has exactly one UnitClass (WEIGHT / VOLUME / COUNT).
 * The base unit for a class is locked to its smallest practical unit (mg / ml / pcs)
 * and is overridable via Setting rows (unit_base_weight / unit_base_volume / unit_base_count).
 *
 * Why mixing classes across a single menu recipe is safe:
 *   computeOrderCogs (lib/cogs-utils.ts) accumulates only RUPIAH across ingredients.
 *   It never adds grams to ml. Class only matters within ONE ingredient (pack conversion).
 */
import type { UnitClass } from "@/generated/prisma";

export type UnitClassName = "WEIGHT" | "VOLUME" | "COUNT";

/** Built-in defaults — used when no Setting override is present. */
export const DEFAULT_BASE_UNIT: Record<UnitClassName, string> = {
  WEIGHT: "mg",
  VOLUME: "ml",
  COUNT:  "pcs",
};

export const SETTING_KEY: Record<UnitClassName, string> = {
  WEIGHT: "unit_base_weight",
  VOLUME: "unit_base_volume",
  COUNT:  "unit_base_count",
};

export const LABEL: Record<UnitClassName, string> = {
  WEIGHT: "Berat",
  VOLUME: "Volume",
  COUNT:  "Jumlah",
};

export const LABEL_FULL: Record<UnitClassName, string> = {
  WEIGHT: "Berat (mg)",
  VOLUME: "Volume (ml)",
  COUNT:  "Jumlah (pcs)",
};

/** Tailwind classes for the UnitClassBadge — matches role-badge palette family. */
export const BADGE_CLASS: Record<UnitClassName, string> = {
  WEIGHT: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  VOLUME: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  COUNT:  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

/**
 * Best-effort mapping from a legacy free-form baseUnit string to a UnitClass.
 * Returns null when ambiguous (caller falls back to COUNT or asks the admin).
 */
export function inferUnitClass(baseUnit: string | null | undefined): UnitClassName | null {
  if (!baseUnit) return null;
  const u = baseUnit.trim().toLowerCase();
  if (["mg", "g", "gr", "gram", "kg", "ons"].includes(u))                                  return "WEIGHT";
  if (["ml", "cc", "l", "lt", "ltr", "liter"].includes(u))                                 return "VOLUME";
  if (["pcs", "pc", "buah", "btg", "batang", "lbr", "lembar", "biji", "ekor", "bks", "sch", "sachet", "pack", "dus", "ikat", "renteng"].includes(u))
                                                                                            return "COUNT";
  return null;
}

/** True if `baseUnit` already matches the resolved smallest unit for `cls`. */
export function isNormalizedBaseUnit(cls: UnitClassName, baseUnit: string, resolved: string): boolean {
  return baseUnit.trim().toLowerCase() === resolved.trim().toLowerCase();
}

/**
 * Resolve the base unit string for a class, reading the Setting override.
 * Pass a settings map (from getSettings()) to avoid an extra round trip.
 * If the override is missing or blank, falls back to DEFAULT_BASE_UNIT.
 */
export function resolveBaseUnit(cls: UnitClassName, settings?: Record<string, string>): string {
  const override = settings?.[SETTING_KEY[cls]]?.trim();
  if (override && override.length > 0) return override;
  return DEFAULT_BASE_UNIT[cls];
}

/** Type-narrow guard. */
export function isUnitClass(v: unknown): v is UnitClassName {
  return v === "WEIGHT" || v === "VOLUME" || v === "COUNT";
}

/** Re-export the Prisma-generated enum so callers can import everything from here. */
export type { UnitClass };
