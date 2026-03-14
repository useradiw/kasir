"use server";

import { prisma } from "@/lib/prisma";
import type {
  Category,
  MenuItem,
  MenuVariant,
  Package,
  PackageItem,
} from "@/lib/db";

export interface ProductSnapshot {
  categories: Category[];
  menuItems: MenuItem[];
  menuVariants: MenuVariant[];
  packages: Package[];
  packageItems: PackageItem[];
}

export async function syncProducts(): Promise<ProductSnapshot> {
  const [categories, menuItems, menuVariants, packages, packageItems] =
    await Promise.all([
      prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.menuItem.findMany(),
      prisma.menuVariant.findMany(),
      prisma.package.findMany(),
      prisma.packageItem.findMany(),
    ]);

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
    menuItems: menuItems.map((m) => ({
      id: m.id,
      name: m.name,
      categoryId: m.categoryId,
      price: m.price,
      isHidden: m.isHidden,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
    menuVariants: menuVariants.map((v) => ({
      id: v.id,
      menuItemId: v.menuItemId,
      label: v.label,
      priceModifier: v.priceModifier,
    })),
    packages: packages.map((p) => ({
      id: p.id,
      name: p.name,
      bundlePrice: p.bundlePrice,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    packageItems: packageItems.map((pi) => ({
      packageId: pi.packageId,
      menuItemId: pi.menuItemId,
      variantId: pi.variantId,
      nameSnapshot: pi.nameSnapshot,
    })),
  };
}
