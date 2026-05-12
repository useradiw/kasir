"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/admin-auth";

export async function getInventoryData() {
  await requireRole("OWNER", "MANAGER");

  const [categories, menuItems, variants, packages, packageItems, onlinePrices] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.menuItem.findMany({
      orderBy: [
        { category: { sortOrder: "asc" } },
        { category: { name: "asc" } },
        { name: "asc" },
      ],
      include: { category: { select: { name: true } } },
    }),
    prisma.menuVariant.findMany({
      orderBy: [{ menuItem: { name: "asc" } }, { label: "asc" }],
      include: { menuItem: { select: { name: true } } },
    }),
    prisma.package.findMany({ orderBy: { name: "asc" } }),
    prisma.packageItem.findMany({
      include: {
        menuItem: { select: { name: true } },
        variant: { select: { label: true } },
      },
    }),
    prisma.menuItemOnlinePrice.findMany({
      orderBy: [{ menuItemId: "asc" }, { service: "asc" }],
    }),
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
      categoryName: m.category.name,
      price: m.price,
      isHidden: m.isHidden,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
    variants: variants.map((v) => ({
      id: v.id,
      menuItemId: v.menuItemId,
      menuItemName: v.menuItem.name,
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
      id: pi.id,
      packageId: pi.packageId,
      menuItemId: pi.menuItemId,
      variantId: pi.variantId,
      nameSnapshot: pi.nameSnapshot,
      menuItemName: pi.menuItem.name,
      variantLabel: pi.variant?.label ?? null,
    })),
    onlinePrices: onlinePrices.map((op) => ({
      id: op.id,
      menuItemId: op.menuItemId,
      variantId: op.variantId,
      service: op.service as string,
      price: op.price,
    })),
  };
}
