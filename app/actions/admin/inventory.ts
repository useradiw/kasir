"use server";

import { revalidateInventory } from "@/lib/revalidate";
import { prisma } from "@/lib/prisma";
import { requireOwner, requireRole } from "@/lib/admin-auth";
import { z } from "zod";
import { ServiceEnum } from "@/generated/prisma";
import { runAction } from "@/lib/action-error";

// ─── Category ─────────────────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().min(1, "Nama tidak boleh kosong"),
  sortOrder: z.coerce.number().int().default(0),
});

export async function addCategory(formData: FormData) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const data = categorySchema.parse({
      name: formData.get("name"),
      sortOrder: formData.get("sortOrder") || 0,
    });
    await prisma.category.create({ data });
    revalidateInventory();
  });
}

export async function updateCategory(id: string, formData: FormData) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const data = categorySchema.parse({
      name: formData.get("name"),
      sortOrder: formData.get("sortOrder") || 0,
    });
    await prisma.category.update({ where: { id }, data });
    revalidateInventory();
  });
}

export async function deleteCategory(id: string) {
  return runAction(async () => {
    await requireOwner();
    await prisma.category.delete({ where: { id } });
    revalidateInventory();
  });
}

// ─── MenuItem ─────────────────────────────────────────────────────────────────

const menuItemSchema = z.object({
  name: z.string().min(1, "Nama tidak boleh kosong"),
  categoryId: z.string().min(1, "Kategori harus dipilih"),
  price: z.coerce.number().int().min(0),
  isHidden: z.coerce.boolean().default(false),
});

export async function addMenuItem(formData: FormData) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const data = menuItemSchema.parse({
      name: formData.get("name"),
      categoryId: formData.get("categoryId"),
      price: formData.get("price"),
      isHidden: formData.get("isHidden") === "true",
    });
    await prisma.menuItem.create({ data });
    revalidateInventory();
  });
}

export async function updateMenuItem(id: string, formData: FormData) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const data = menuItemSchema.parse({
      name: formData.get("name"),
      categoryId: formData.get("categoryId"),
      price: formData.get("price"),
      isHidden: formData.get("isHidden") === "true",
    });
    await prisma.menuItem.update({ where: { id }, data });
    revalidateInventory();
  });
}

export async function deleteMenuItem(id: string) {
  return runAction(async () => {
    await requireOwner();
    await prisma.menuItem.delete({ where: { id } });
    revalidateInventory();
  });
}

export async function toggleMenuItemVisibility(id: string, current: boolean) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    await prisma.menuItem.update({ where: { id }, data: { isHidden: !current } });
    revalidateInventory();
  });
}

// ─── MenuVariant ──────────────────────────────────────────────────────────────

const variantSchema = z.object({
  menuItemId: z.string().min(1),
  label: z.string().min(1, "Label tidak boleh kosong"),
  priceModifier: z.coerce.number().int().default(0),
});

export async function addVariant(formData: FormData) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const data = variantSchema.parse({
      menuItemId: formData.get("menuItemId"),
      label: formData.get("label"),
      priceModifier: formData.get("priceModifier") || 0,
    });
    await prisma.menuVariant.create({ data });
    revalidateInventory();
  });
}

export async function updateVariant(id: string, formData: FormData) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const data = variantSchema.parse({
      menuItemId: formData.get("menuItemId"),
      label: formData.get("label"),
      priceModifier: formData.get("priceModifier") || 0,
    });
    await prisma.menuVariant.update({ where: { id }, data });
    revalidateInventory();
  });
}

export async function deleteVariant(id: string) {
  return runAction(async () => {
    await requireOwner();
    await prisma.menuVariant.delete({ where: { id } });
    revalidateInventory();
  });
}

// ─── Package ──────────────────────────────────────────────────────────────────

const packageSchema = z.object({
  name: z.string().min(1, "Nama tidak boleh kosong"),
  bundlePrice: z.coerce.number().int().min(0),
});

export async function addPackage(formData: FormData) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const data = packageSchema.parse({
      name: formData.get("name"),
      bundlePrice: formData.get("bundlePrice"),
    });
    await prisma.package.create({ data });
    revalidateInventory();
  });
}

export async function updatePackage(id: string, formData: FormData) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const data = packageSchema.parse({
      name: formData.get("name"),
      bundlePrice: formData.get("bundlePrice"),
    });
    await prisma.package.update({ where: { id }, data });
    revalidateInventory();
  });
}

export async function deletePackage(id: string) {
  return runAction(async () => {
    await requireOwner();
    await prisma.package.delete({ where: { id } });
    revalidateInventory();
  });
}

export async function addPackageItem(formData: FormData) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const packageId = formData.get("packageId") as string;
    const menuItemId = formData.get("menuItemId") as string;
    const variantId = (formData.get("variantId") as string) || null;
    const nameSnapshot = formData.get("nameSnapshot") as string;

    if (!packageId || !menuItemId || !nameSnapshot) {
      throw new Error("Data tidak lengkap.");
    }

    const existing = await prisma.packageItem.findFirst({
      where: { packageId, menuItemId, variantId },
    });

    if (existing) {
      await prisma.packageItem.update({
        where: { id: existing.id },
        data: { nameSnapshot },
      });
    } else {
      await prisma.packageItem.create({
        data: { packageId, menuItemId, variantId, nameSnapshot },
      });
    }
    revalidateInventory();
  });
}

export async function deletePackageItem(id: string) {
  return runAction(async () => {
    await requireOwner();
    await prisma.packageItem.delete({ where: { id } });
    revalidateInventory();
  });
}

// ─── Online Pricing ──────────────────────────────────────────────────────────

const onlinePriceSchema = z.object({
  menuItemId: z.string().min(1),
  variantId: z.string().nullable().optional(),
  service: z.enum(["GoFood", "ShopeeFood", "GrabFood"]),
  price: z.coerce.number().int().min(0),
});

export async function setOnlinePrice(data: {
  menuItemId: string;
  variantId?: string | null;
  service: string;
  price: number;
}) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    const parsed = onlinePriceSchema.parse(data);
    const { menuItemId, service, price } = parsed;
    const variantId = parsed.variantId ?? null;

    const existing = await prisma.menuItemOnlinePrice.findFirst({
      where: { menuItemId, variantId, service: service as ServiceEnum },
    });

    if (existing) {
      await prisma.menuItemOnlinePrice.update({
        where: { id: existing.id },
        data: { price },
      });
    } else {
      await prisma.menuItemOnlinePrice.create({
        data: { menuItemId, variantId, service: service as ServiceEnum, price },
      });
    }
    revalidateInventory();
  });
}

export async function deleteOnlinePrice(id: string) {
  return runAction(async () => {
    await requireRole("OWNER", "MANAGER");
    await prisma.menuItemOnlinePrice.delete({ where: { id } });
    revalidateInventory();
  });
}
